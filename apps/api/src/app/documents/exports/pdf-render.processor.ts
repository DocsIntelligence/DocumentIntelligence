import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  PdfRendererService,
  type PdfRenderJobPayload,
} from './pdf-renderer.service';

export const PDF_RENDER_QUEUE = 'doc-pdf';
export type { PdfRenderJobPayload } from './pdf-renderer.service';

/**
 * BullMQ worker for PDF renders. Delegates to PdfRendererService so the
 * same code path runs whether the job arrived via the queue or via the
 * inline fallback (when REDIS_URL is unset).
 */
@Processor(PDF_RENDER_QUEUE)
export class PdfRenderProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfRenderProcessor.name);

  constructor(private readonly renderer: PdfRendererService) {
    super();
  }

  async process(job: Job<PdfRenderJobPayload>): Promise<void> {
    await this.renderer.render(job.data);
  }
}
