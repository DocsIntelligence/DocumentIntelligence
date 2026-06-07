import { Injectable, Logger } from '@nestjs/common';
import { PageSize } from '@prisma/client';
import { createHash } from 'node:crypto';
import puppeteer, { type Browser } from 'puppeteer-core';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { errorMessage, errorDetail } from '../../common/error.util';

export interface PdfRenderJobPayload {
  exportId: string;
  documentId: string;
  pageSize: PageSize;
  componentKey: string;
}

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

    // Fetch the document data here, then push it inline through the URL.
    // This avoids a second network call from inside the (Browserless)
    // browser back to the API — that call would have to resolve a
    // hostname reachable from inside the container, which is a fragile
    // setup that's bitten us already. Encoding is URL-encoded JSON,
    // UTF-8 safe (the legacy base64 atob path mangled non-ASCII text).
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      select: { data: true },
    });
    if (!doc) {
      await this.fail(exportId, `Document ${documentId} not found`);
      throw new Error(`Document ${documentId} not found`);
    }

    // When connecting to a remote browser (Browserless in Docker), the
    // browser sees a different "localhost" than the API process does.
    // Rewrite to host.docker.internal so dev "just works" on macOS/Windows.
    // Set ARTBOARD_URL explicitly to override (e.g. on Linux without the
    // host-gateway alias, point at the host's LAN IP).
    const artboardUrl = this.rewriteForRemoteBrowser(rawArtboardUrl);
    const encodedData = encodeURIComponent(JSON.stringify(doc.data ?? {}));

    const url = `${artboardUrl.replace(/\/$/, '')}/render/${encodeURIComponent(
      componentKey,
    )}?data=${encodedData}&pageSize=${encodeURIComponent(pageSize)}`;

    let acquired: { browser: Browser; dispose: () => Promise<void> } | null =
      null;
    try {
      acquired = await this.acquireBrowser();
      const page = await acquired.browser.newPage();
      await page.setViewport({ width: 1240, height: 1754 });

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

      const buffer = Buffer.from(
        await page.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
        }),
      );

      const upload = await this.storage.upload(buffer, {
        filename: `${documentId}-${exportId}.pdf`,
        contentType: 'application/pdf',
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
      this.logger.error(`✗ Render failed for ${documentId}: ${msg}`, errorDetail(e));
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
      this.logger.error(
        `Could not record failure on export ${exportId}: ${e}`,
      );
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
