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
import {
  PDF_RENDER_QUEUE,
  type PdfRenderJobPayload,
} from './pdf-render.processor';

export const PDF_QUEUE_ENABLED = 'PDF_QUEUE_ENABLED';

/**
 * Enqueues PDF export jobs and exposes status reads. If Redis isn't
 * configured, exports stay in "pending" forever — surface that to the
 * caller as a friendly error rather than silently dropping the job.
 *
 * The processor (pdf-render.processor.ts) handles the actual rendering.
 */
@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    @Optional()
    @InjectQueue(PDF_RENDER_QUEUE)
    private readonly queue: Queue | null,
    @Inject(PDF_QUEUE_ENABLED) private readonly enabled: boolean,
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
        status: this.enabled ? 'pending' : 'failed',
        error: this.enabled
          ? null
          : 'PDF queue disabled: set REDIS_URL to enable exports.',
      },
    });

    if (!this.enabled || !this.queue) {
      return exp;
    }

    const payload: PdfRenderJobPayload = {
      exportId: exp.id,
      documentId: doc.id,
      pageSize: targetPageSize,
      componentKey: doc.template.componentKey,
    };

    await this.queue.add('render', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    });
    this.logger.debug(`Queued PDF render for export ${exp.id}`);
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
