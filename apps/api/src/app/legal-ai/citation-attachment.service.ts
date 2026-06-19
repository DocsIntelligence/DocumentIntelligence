import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { LegalReferenceService } from './legal-reference.service';

/** Allowed attachment kinds (kept loose — admin-curated, not user input). */
export const CITATION_ATTACHMENT_KINDS = [
  'bare-act',
  'commentary',
  'judgment',
  'circular',
  'notification',
  'other',
] as const;
export type CitationAttachmentKind = (typeof CITATION_ATTACHMENT_KINDS)[number];

/** Shape returned to clients — DB metadata plus a resolved download URL. */
export interface CitationAttachmentView {
  id: string;
  citationId: string;
  kind: string;
  title: string;
  filename: string;
  contentType: string;
  byteSize: number | null;
  isPublic: boolean;
  sortOrder: number;
  createdAt: string;
  /** Presigned (S3) or public-stream (local-fs) download URL. */
  url: string;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — "longer proper docs" but not unbounded.
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);

/**
 * Manages files attached to a legal citation (bare-act PDFs, commentary,
 * judgments, circulars). Bytes go to object storage; rows hold the key +
 * metadata. Public files surface on the `/law/:id` page for download.
 *
 * Admin-only writes (the controller guards them); the public read path goes
 * through `listPublic`, which also enforces the citation's own `isPublic`.
 */
@Injectable()
export class CitationAttachmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly refs: LegalReferenceService,
  ) {}

  /** All attachments for a citation (admin view), newest sort-order first. */
  async list(citationId: string): Promise<CitationAttachmentView[]> {
    const rows = await this.db.legalCitationAttachment.findMany({
      where: { citationId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.toView(r)));
  }

  /**
   * Public attachments for a citation — only when BOTH the citation and the
   * file are public. Returns [] for a private/unknown citation (the public
   * page just hides the section).
   */
  async listPublic(citationId: string): Promise<CitationAttachmentView[]> {
    const publicList = await this.refs.listPublic();
    if (!publicList.some((c) => c.id === citationId)) return [];
    const rows = await this.db.legalCitationAttachment.findMany({
      where: { citationId, isPublic: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return Promise.all(rows.map((r) => this.toView(r)));
  }

  async upload(
    citationId: string,
    file: Express.Multer.File,
    meta: { title?: string; kind?: string; isPublic?: boolean },
  ): Promise<CitationAttachmentView> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_BYTES / 1024 / 1024} MB.`,
      );
    }
    if (file.mimetype && !ALLOWED_CONTENT_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: PDF, Word, PNG, JPEG.`,
      );
    }
    // The citation must exist (DB row or code seed). Materialise a DB row for a
    // code-only seed so the FK holds — createOrUpdate is a no-op upsert here.
    const citation = await this.refs.getAdmin(citationId);
    if (!citation) {
      throw new NotFoundException(`Unknown citation: ${citationId}`);
    }
    if (citation.source === 'code') {
      await this.refs.createOrUpdate({ ...citation });
      this.refs.invalidate();
    }

    const stored = await this.storage.upload(file.buffer, {
      filename: file.originalname || 'attachment',
      contentType: file.mimetype || 'application/octet-stream',
      folder: `legal-citations/${citationId}`,
    });

    const last = await this.db.legalCitationAttachment.findFirst({
      where: { citationId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const row = await this.db.legalCitationAttachment.create({
      data: {
        citationId,
        kind: this.normaliseKind(meta.kind),
        title: (meta.title || file.originalname || 'Document').slice(0, 200),
        filename: file.originalname || 'attachment',
        contentType: file.mimetype || 'application/octet-stream',
        byteSize: file.size,
        s3Key: stored.key,
        isPublic: meta.isPublic ?? true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return this.toView(row);
  }

  async setPublic(
    citationId: string,
    attachmentId: string,
    isPublic: boolean,
  ): Promise<CitationAttachmentView> {
    const row = await this.requireOwned(citationId, attachmentId);
    const updated = await this.db.legalCitationAttachment.update({
      where: { id: row.id },
      data: { isPublic },
    });
    return this.toView(updated);
  }

  async remove(citationId: string, attachmentId: string): Promise<{ id: string }> {
    const row = await this.requireOwned(citationId, attachmentId);
    // Best-effort storage cleanup — a failed delete shouldn't strand the row.
    try {
      await this.storage.delete(row.s3Key);
    } catch {
      /* swallow — the metadata row is the source of truth for the UI */
    }
    await this.db.legalCitationAttachment.delete({ where: { id: row.id } });
    return { id: attachmentId };
  }

  private async requireOwned(citationId: string, attachmentId: string) {
    const row = await this.db.legalCitationAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!row || row.citationId !== citationId) {
      throw new NotFoundException(`Attachment "${attachmentId}" not found`);
    }
    return row;
  }

  private normaliseKind(kind?: string): string {
    const k = (kind ?? '').trim().toLowerCase();
    return (CITATION_ATTACHMENT_KINDS as readonly string[]).includes(k)
      ? k
      : 'other';
  }

  private async toView(row: {
    id: string;
    citationId: string;
    kind: string;
    title: string;
    filename: string;
    contentType: string;
    byteSize: number | null;
    isPublic: boolean;
    sortOrder: number;
    createdAt: Date;
    s3Key: string;
  }): Promise<CitationAttachmentView> {
    return {
      id: row.id,
      citationId: row.citationId,
      kind: row.kind,
      title: row.title,
      filename: row.filename,
      contentType: row.contentType,
      byteSize: row.byteSize,
      isPublic: row.isPublic,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      url: await this.storage.getPresignedDownloadUrl(row.s3Key),
    };
  }
}
