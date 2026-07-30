import { Injectable, Logger } from '@nestjs/common';
import { PageSize, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import HTMLtoDOCX from '@turbodocx/html-to-docx';
import type { ExportFormat } from '@org/dto';
import {
  appendSignaturesToHtml,
  type SignatureSignerInput,
} from '@org/legal-reference';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { errorMessage, errorDetail } from '../../common/error.util';

export interface PdfRenderJobPayload {
  exportId: string;
  documentId: string;
  pageSize: PageSize;
  componentKey: string;
  /** Output format. `png` screenshots the same artboard page; defaults to pdf. */
  format?: ExportFormat;
}

/** File extension + MIME per export format (used for the S3 object). */
const OUTPUT_META: Record<ExportFormat, { ext: string; contentType: string }> = {
  pdf: { ext: 'pdf', contentType: 'application/pdf' },
  png: { ext: 'png', contentType: 'image/png' },
  docx: {
    ext: 'docx',
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
};

/**
 * Owns the actual Puppeteer → PDF → S3 pipeline. Decoupled from BullMQ so
 * it can be invoked either:
 *   - From the BullMQ worker (when REDIS_URL is set), or
 *   - Directly from ExportsService (inline fallback when Redis is absent).
 *
 * Writes the DocumentExport row's terminal status itself, so callers
 * don't need to wrap success/failure handling.
 */
@Injectable()
export class PdfRendererService {
  private readonly logger = new Logger(PdfRendererService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  async render(payload: PdfRenderJobPayload): Promise<void> {
    const { exportId, documentId, pageSize, componentKey } = payload;
    const rawArtboardUrl = process.env.ARTBOARD_URL;

    if (!rawArtboardUrl) {
      await this.fail(exportId, 'ARTBOARD_URL is not set');
      throw new Error('ARTBOARD_URL is not set');
    }

    // Fetch the document data, then push it into the page as an injected
    // global (NOT the URL). Earlier this rode along the URL query string,
    // but a large document (long court drafts, embedded images, or a
    // signature block) blows past the artboard server's request-line /
    // header size limit and comes back HTTP 431. `evaluateOnNewDocument`
    // ships the payload over the DevTools protocol instead — no size cap —
    // and still avoids a second network call back to the API (the fragile
    // in-container hostname resolution we moved away from).
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      select: { data: true, title: true },
    });
    if (!doc) {
      await this.fail(exportId, `Document ${documentId} not found`);
      throw new Error(`Document ${documentId} not found`);
    }

    // Append captured signatures (+ audit page) for freeform/HTML docs, so the
    // exported PDF matches the render-payload path and the live preview.
    const withSignatures = await this.withSignatures(documentId, doc.data);
    // Same host rewrite as the artboard URL below, but applied to asset URLs
    // *embedded in the document content* (e.g. an inserted page image served
    // from local-fs storage at PUBLIC_URL) — from inside the Browserless
    // container "localhost" is the container itself, not this host, so the
    // image would otherwise fail to load and Chrome falls back to the alt text.
    const renderData = this.rewriteAssetUrlsForRemoteBrowser(withSignatures);

    // When connecting to a remote browser (Browserless in Docker), the
    // browser sees a different "localhost" than the API process does.
    // Rewrite to host.docker.internal so dev "just works" on macOS/Windows.
    // Set ARTBOARD_URL explicitly to override (e.g. on Linux without the
    // host-gateway alias, point at the host's LAN IP).
    const artboardUrl = this.rewriteForRemoteBrowser(rawArtboardUrl);

    // Opt-in pagination diagnostic: when PAGINATION_DEBUG is set, append the
    // query flag so the artboard prints the measured page/block/font report
    // into the PDF (see docs/PAGINATION_DEBUG.md). Off in normal exports.
    const debugQs =
      process.env.PAGINATION_DEBUG === '1' ||
      process.env.PAGINATION_DEBUG === 'true'
        ? '&paginationDebug=1'
        : '';

    const url = `${artboardUrl.replace(/\/$/, '')}/render/${encodeURIComponent(
      componentKey,
    )}?pageSize=${encodeURIComponent(pageSize)}${debugQs}`;

    let acquired: { browser: Browser; dispose: () => Promise<void> } | null =
      null;
    try {
      acquired = await this.acquireBrowser();
      const page = await acquired.browser.newPage();
      await page.setViewport({ width: 1240, height: 1754 });

      // Inject the document data before any page script runs. RenderRoute
      // reads `window.__ARTBOARD_DATA__` first, falling back to ?data= / the
      // API for older callers.
      await page.evaluateOnNewDocument(
        (injected) => {
          (globalThis as unknown as Record<string, unknown>).__ARTBOARD_DATA__ =
            injected;
        },
        (renderData ?? {}) as Prisma.JsonValue,
      );

      this.logger.debug(`Rendering ${url}`);
      const response = await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 30_000,
      });
      if (!response || !response.ok()) {
        throw new Error(
          `Artboard responded ${response?.status() ?? 'no response'}`,
        );
      }

      await page.waitForFunction('window.__ARTBOARD_READY__ === true', {
        timeout: 15_000,
      });

      const format: ExportFormat = payload.format ?? 'pdf';
      let buffer: Buffer;
      if (format === 'png') {
        // Full-page PNG of the rendered artboard (same page, same fidelity).
        buffer = Buffer.from(await page.screenshot({ type: 'png', fullPage: true }));
      } else if (format === 'docx') {
        // True OOXML Word doc built from the SAME rendered HTML the PDF uses —
        // so it covers every template (freeform + structured bundles), not just
        // docs that happen to carry raw `html`.
        buffer = await this.renderDocx(page, doc.title);
      } else {
        buffer = Buffer.from(
          await page.pdf({
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
          }),
        );
      }

      const out = OUTPUT_META[format];
      const upload = await this.storage.upload(buffer, {
        filename: `${documentId}-${exportId}.${out.ext}`,
        contentType: out.contentType,
        folder: `documents/${documentId}/exports`,
      });

      const checksum = createHash('sha256').update(buffer).digest('hex');

      await this.db.documentExport.update({
        where: { id: exportId },
        data: {
          status: 'ready',
          s3Key: upload.key,
          byteSize: buffer.byteLength,
          checksum,
          error: null,
        },
      });
      this.logger.log(
        `✓ Exported document ${documentId} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
      );
    } catch (e) {
      const msg = errorMessage(e);
      // Log the full error (stack / deep inspect) so non-Error rejections
      // from the browser transport or SDKs aren't swallowed.
      this.logger.error(
        `✗ Render failed for ${documentId}: ${msg}`,
        errorDetail(e),
      );
      await this.fail(exportId, msg);
      throw e;
    } finally {
      if (acquired) {
        try {
          await acquired.dispose();
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Build a true OOXML `.docx` from the already-rendered artboard page.
   *
   * We scrape each rendered `.doc-page`'s inner HTML (the same DOM Puppeteer
   * would print to PDF) rather than the document's raw `data.html`, because
   * structured-bundle templates have NO raw HTML — their content only exists
   * once React has rendered. The Paginator's offscreen measurement mirror is a
   * non-`.doc-page` sibling, so selecting `.doc-page` naturally excludes it; we
   * also strip `aria-hidden` chrome (the "Page N of M" footers) and any
   * `<style>`/`<script>`. Word re-paginates on its own, so we join logical
   * pages with a hard page break and let it reflow.
   *
   * Fidelity note: the artboard's page styling lives in a `<style>` cascade
   * (`.doc-page …`), not inline, so html-to-docx (which honours element tags +
   * inline styles) won't carry the centered/underlined heading treatment — the
   * structure, text, lists and tables transfer; fine-grained typography does
   * not. This is the accepted v1 trade-off for an *editable* Word file.
   */
  private async renderDocx(page: Page, title: string): Promise<Buffer> {
    const content = await page.evaluate(() => {
      const strip = (root: Element): string => {
        const clone = root.cloneNode(true) as Element;
        clone
          .querySelectorAll('[aria-hidden="true"], style, script')
          .forEach((n) => n.remove());
        return clone.innerHTML;
      };
      const pages = Array.from(document.querySelectorAll('.doc-page'));
      const pageBreak = '<br style="page-break-before:always" />';
      if (pages.length > 0) {
        return pages.map(strip).join(pageBreak);
      }
      // Fallback for templates that don't use the paged layout (e.g. invoices):
      // take the whole body, minus the offscreen mirror / chrome.
      return strip(document.body);
    });

    const safeTitle = (title || 'Document').replace(/[<>&]/g, '');
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${safeTitle}</title></head>
<body>${content}</body>
</html>`;

    const result = await HTMLtoDOCX(html, null, {
      title: safeTitle,
      orientation: 'portrait',
      // 2cm margins (≈1134 twip) — matches the legacy client `.doc` export.
      margins: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
      font: 'Times New Roman',
      fontSize: 24, // half-points → 12pt
      table: { row: { cantSplit: true } },
    });
    return Buffer.from(result as ArrayBuffer);
  }

  /**
   * For freeform/HTML documents, append captured signatures (+ an audit page)
   * to the body so the exported PDF includes them. Mirrors
   * `DocumentsService.renderPayload` — kept in sync deliberately since the PDF
   * worker reads `doc.data` directly rather than going through that endpoint.
   */
  private async withSignatures(
    documentId: string,
    data: Prisma.JsonValue | null,
  ): Promise<Prisma.JsonValue | null> {
    const body = data as { html?: unknown } | null;
    if (!body || typeof body.html !== 'string') return data;

    const signers = await this.db.documentSigner.findMany({
      where: { documentId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    if (signers.length === 0) return data;

    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    const mapped: SignatureSignerInput[] = signers.map((s) => {
      const ev = (s.evidence ?? {}) as Record<string, unknown>;
      return {
        name: s.name,
        email: s.email,
        role: s.role,
        status: s.status,
        method: s.provider ?? str(ev.method),
        image: str(ev.image),
        typedText: str(ev.typedText),
        font: str(ev.font),
        signedAt: s.signedAt ? s.signedAt.toISOString() : str(ev.signedAt),
        ip: str(ev.ip),
        userAgent: str(ev.userAgent),
      };
    });

    return {
      ...(body as object),
      html: appendSignaturesToHtml(body.html, mapped),
    } as Prisma.JsonValue;
  }

  /**
   * Acquire a Chrome instance. Two modes, in priority order:
   *
   *   1. Remote (Browserless / chrome-headless-shell over WS) — when
   *      CHROME_URL is set. We `connect` rather than `launch`, and we
   *      `disconnect` rather than `close` so we don't shut down a shared
   *      Browserless instance for everyone.
   *   2. Local — when PUPPETEER_EXECUTABLE_PATH points at a Chromium
   *      binary. Suitable for docker images that bundle Chrome.
   *
   * Env vars consumed:
   *   CHROME_URL              ws://host:port (Browserless WS endpoint)
   *   CHROME_TOKEN            appended as ?token=... if present
   *   CHROME_IGNORE_HTTPS_ERRORS  "true" → acceptInsecureCerts on connect
   */
  private async acquireBrowser(): Promise<{
    browser: Browser;
    dispose: () => Promise<void>;
  }> {
    const chromeUrl = process.env.CHROME_URL;
    if (chromeUrl) {
      const token = process.env.CHROME_TOKEN;
      const endpoint = token
        ? `${chromeUrl}${chromeUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(
            token,
          )}`
        : chromeUrl;
      let browser: Browser;
      try {
        browser = await puppeteer.connect({
          browserWSEndpoint: endpoint,
          acceptInsecureCerts:
            process.env.CHROME_IGNORE_HTTPS_ERRORS === 'true',
        });
      } catch (e) {
        // puppeteer.connect to a dead/refusing WS endpoint can reject with a
        // non-Error transport object — wrap it so the stored message is useful.
        throw new Error(
          `Could not connect to headless browser at ${chromeUrl} — is the Browserless/Chrome endpoint (CHROME_URL) running and reachable? (${errorMessage(
            e,
          )})`,
        );
      }
      return { browser, dispose: () => browser.disconnect() };
    }

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      throw new Error(
        'Neither CHROME_URL (Browserless WS endpoint) nor PUPPETEER_EXECUTABLE_PATH (local Chromium binary) is set.',
      );
    }
    const extraArgs = parseLaunchArgs(process.env.PUPPETEER_LAUNCH_ARGS);
    let browser: Browser;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          ...extraArgs,
        ],
      });
    } catch (e) {
      throw new Error(
        `Could not launch local Chromium at ${executablePath} (PUPPETEER_EXECUTABLE_PATH) — is the binary present? (${errorMessage(
          e,
        )})`,
      );
    }
    return { browser, dispose: () => browser.close() };
  }

  /**
   * Rewrite `http://localhost:PORT` / `http://127.0.0.1:PORT` references
   * anywhere inside the document payload (e.g. an `<img src>` pointing at
   * local-fs storage) to `host.docker.internal`, so the remote Browserless
   * container can actually fetch them. No-op unless CHROME_URL is set, and a
   * no-op in practice once storage is S3-backed (those URLs aren't localhost).
   */
  private rewriteAssetUrlsForRemoteBrowser(
    data: Prisma.JsonValue | null,
  ): Prisma.JsonValue | null {
    if (!process.env.CHROME_URL || data == null) return data;
    const json = JSON.stringify(data).replace(
      /http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/g,
      'http://host.docker.internal:$1',
    );
    return JSON.parse(json) as Prisma.JsonValue;
  }

  private rewriteForRemoteBrowser(url: string): string {
    if (!process.env.CHROME_URL) return url;
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        const original = parsed.hostname;
        parsed.hostname = 'host.docker.internal';
        this.logger.debug(
          `Rewriting artboard URL ${original} → host.docker.internal for remote browser`,
        );
        return parsed.toString();
      }
    } catch {
      // Malformed URL — let the downstream fetch fail with a clearer error.
    }
    return url;
  }

  private async fail(exportId: string, message: string): Promise<void> {
    try {
      await this.db.documentExport.update({
        where: { id: exportId },
        data: { status: 'failed', error: message },
      });
    } catch (e) {
      this.logger.error(`Could not record failure on export ${exportId}: ${e}`);
    }
  }
}

function parseLaunchArgs(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed;
    }
  } catch {
    // ignore — fall through to raw split
  }
  return raw
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
}
