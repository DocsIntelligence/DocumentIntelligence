import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PageSize } from '@prisma/client';
import { Queue } from 'bullmq';
import { DatabaseService } from '../../database/database.service';
import { PDF_RENDER_QUEUE } from './pdf-render.processor';
import {
  PdfRendererService,
  type PdfRenderJobPayload,
} from './pdf-renderer.service';

export const PDF_QUEUE_ENABLED = 'PDF_QUEUE_ENABLED';

/**
 * Enqueues PDF export jobs and exposes status reads.
 *
 *   REDIS_URL set     → enqueue on BullMQ, worker picks it up.
 *   REDIS_URL not set → render inline via PdfRendererService, fire-and-
 *                       forget. Status transitions exactly as in the
 *                       queued case (pending → ready/failed), so the
 *                       client polls the same way.
 */
@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    @Optional()
    @InjectQueue(PDF_RENDER_QUEUE)
    private readonly queue: Queue | null,
    @Inject(PDF_QUEUE_ENABLED) private readonly enabled: boolean,
    private readonly renderer: PdfRendererService,
    private readonly db: DatabaseService,
  ) {}

  async enqueueExport(
    userId: string,
    documentId: string,
    pageSize?: PageSize,
  ) {
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      include: { template: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertCanExport(userId, doc);

    const targetPageSize = pageSize ?? doc.pageSize;

    const exp = await this.db.documentExport.create({
      data: {
        documentId: doc.id,
        format: 'pdf',
        pageSize: targetPageSize,
        status: 'pending',
        error: null,
      },
    });

    const payload: PdfRenderJobPayload = {
      exportId: exp.id,
      documentId: doc.id,
      pageSize: targetPageSize,
      componentKey: doc.template.componentKey,
    };

    if (this.enabled && this.queue) {
      await this.queue.add('render', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      });
      this.logger.debug(`Queued PDF render for export ${exp.id}`);
      return exp;
    }

    // No Redis — kick off the render inline. We deliberately don't await:
    // the HTTP response returns immediately with status='pending', and
    // the client polls getExport() exactly as it does in the queued case.
    // PdfRendererService writes the terminal status itself.
    setImmediate(() => {
      void this.renderer.render(payload).catch((e) => {
        this.logger.error(
          `Inline render failed for export ${exp.id}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      });
    });
    this.logger.debug(`Rendering PDF inline for export ${exp.id} (no Redis)`);
    return exp;
  }

  async getExport(userId: string, documentId: string, exportId: string) {
    const exp = await this.db.documentExport.findUnique({
      where: { id: exportId },
      include: { document: true },
    });
    if (!exp || exp.documentId !== documentId) {
      throw new NotFoundException('Export not found');
    }
    await this.assertCanExport(userId, exp.document);
    return {
      id: exp.id,
      status: exp.status,
      pageSize: exp.pageSize,
      format: exp.format,
      s3Key: exp.s3Key,
      byteSize: exp.byteSize,
      error: exp.error,
      createdAt: exp.createdAt,
      updatedAt: exp.updatedAt,
    };
  }

  // ─── Authorization ─────────────────────────────────────────────────────

  private async assertCanExport(
    userId: string,
    doc: { ownerUserId: string | null; ownerOrgId: string | null },
  ) {
    if (doc.ownerUserId === userId) return;
    if (doc.ownerOrgId) {
      const m = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: doc.ownerOrgId, userId } },
      });
      if (m) return;
    }
    throw new ForbiddenException('Not allowed');
  }
}
