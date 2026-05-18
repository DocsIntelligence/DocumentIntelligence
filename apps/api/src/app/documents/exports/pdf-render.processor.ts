import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PageSize } from '@prisma/client';
import { Job } from 'bullmq';
import { createHash } from 'node:crypto';
import puppeteer, { type Browser } from 'puppeteer-core';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';

export const PDF_RENDER_QUEUE = 'doc-pdf';

export interface PdfRenderJobPayload {
  exportId: string;
  documentId: string;
  pageSize: PageSize;
  componentKey: string;
}

/**
 * PDF render worker. Navigates a headless Chromium to apps/artboard's
 * /render/:componentKey route, waits for the artboard's readiness signal,
 * calls page.pdf() at the document's declared page size, and uploads the
 * resulting PDF to S3. Persists the result in DocumentExport.
 *
 * Browser launching strategy:
 *   - PUPPETEER_EXECUTABLE_PATH — use system Chrome (dev / docker)
 *   - PUPPETEER_LAUNCH_ARGS — JSON array of extra CLI flags
 *   - In serverless contexts, wire @sparticuz/chromium and pass its
 *     executablePath via env. We intentionally do not import it directly
 *     here to keep the bundle lean.
 *
 * Failure mode: marks DocumentExport.status='failed' with the message.
 * BullMQ retries with exponential backoff per job options.
 */
@Processor(PDF_RENDER_QUEUE)
export class PdfRenderProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfRenderProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<PdfRenderJobPayload>): Promise<void> {
    const { exportId, documentId, pageSize, componentKey } = job.data;
    const artboardUrl = process.env.ARTBOARD_URL;
    const renderToken = process.env.INTERNAL_RENDER_TOKEN;

    if (!artboardUrl) {
      await this.fail(exportId, 'ARTBOARD_URL is not set');
      return;
    }
    if (!renderToken) {
      await this.fail(exportId, 'INTERNAL_RENDER_TOKEN is not set');
      return;
    }

    const url = `${artboardUrl.replace(/\/$/, '')}/render/${encodeURIComponent(
      componentKey,
    )}?docId=${encodeURIComponent(documentId)}&token=${encodeURIComponent(
      renderToken,
    )}&pageSize=${encodeURIComponent(pageSize)}`;

    let browser: Browser | null = null;
    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();
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

      // Wait for the artboard to set window.__ARTBOARD_READY__ = true
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
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`✗ Render failed for ${documentId}: ${msg}`);
      await this.fail(exportId, msg);
      throw e; // BullMQ will retry per job options
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore
        }
      }
    }
  }

  private async launchBrowser(): Promise<Browser> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      throw new Error(
        'PUPPETEER_EXECUTABLE_PATH is not set. Point it at a Chrome/Chromium binary.',
      );
    }
    const extraArgs = parseLaunchArgs(process.env.PUPPETEER_LAUNCH_ARGS);
    return puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        ...extraArgs,
      ],
    });
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
