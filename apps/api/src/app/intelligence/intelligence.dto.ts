import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/** Requested extraction tier (mirrors Prisma ExtractionEngineMode). */
export const EngineModeSchema = z
  .enum(['auto', 'native', 'vlm', 'agentic'])
  .default('auto');

/** Register a file already uploaded via a presigned URL, then start a job. */
const RegisterSourceSchema = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(120),
  s3Key: z.string().min(1).max(500),
  byteSize: z.number().int().min(0).optional(),
  language: z.string().min(2).max(8).optional(),
  ownerOrgId: z.string().cuid().optional(),
  engine: EngineModeSchema,
});

export class RegisterSourceDto extends createZodDto(RegisterSourceSchema) {}

/** Get a presigned PUT URL for direct-to-S3 upload. */
const PresignUploadSchema = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(120),
});

export class PresignUploadDto extends createZodDto(PresignUploadSchema) {}

/** A single human correction applied in the review UI. */
const FieldEditSchema = z.object({
  fieldPath: z.string().min(1),
  newValue: z.unknown(),
});

/** Save reviewed/corrected extraction values (the Phase-1 review UI backend). */
const SaveReviewSchema = z.object({
  /** Full corrected field values (authoritative after review). */
  fields: z.record(z.string(), z.unknown()),
  /** The individual edits, for the audit trail / active-learning signal. */
  edits: z.array(FieldEditSchema).default([]),
  /** Mark the extraction human-validated (default true on save). */
  markReviewed: z.boolean().default(true),
});

export class SaveReviewDto extends createZodDto(SaveReviewSchema) {}

/** Ask a question about a document (RAG, page-cited answer). */
const AskSchema = z.object({
  question: z.string().min(1).max(2000),
});

export class AskDto extends createZodDto(AskSchema) {}

/** Manually archive (skip) a single run. */
const ArchiveRunSchema = z.object({
  reason: z.string().max(500).optional(),
});
export class ArchiveRunDto extends createZodDto(ArchiveRunSchema) {}

/** Archive many runs at once (e.g. "skip all of type X"). */
const BulkArchiveSchema = z.object({
  runIds: z.array(z.string().min(1)).min(1).max(5000),
  reason: z.string().max(500).optional(),
});
export class BulkArchiveDto extends createZodDto(BulkArchiveSchema) {}

/**
 * Unified bulk action on a set of pipeline runs. One endpoint covers
 * approve / archive (and any future verbs) so the client never has to
 * pick between three near-identical mutations.
 */
const BulkRunActionSchema = z.object({
  action: z.enum(['approve', 'archive']),
  runIds: z.array(z.string().min(1)).min(1).max(500),
  reason: z.string().max(500).optional(),
});
export class BulkRunActionDto extends createZodDto(BulkRunActionSchema) {}

/** Re-extract a source as a reviewer-chosen type (manual override). */
const ReprocessSchema = z.object({
  schemaKey: z.string().min(1).max(120),
});
export class ReprocessDto extends createZodDto(ReprocessSchema) {}

/** Server-side pagination/search/sort for the batches list. */
const ListBatchesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z
    .enum(['running', 'needs_review', 'completed', 'failed'])
    .optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(['name', 'status', 'created']).default('created'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export class ListBatchesQueryDto extends createZodDto(ListBatchesQuerySchema) {}

/** Server-side pagination/filter for a batch's runs (docs/09 #9). */
const ListRunsQuerySchema = z.object({
  status: z
    .enum([
      'queued',
      'running',
      'needs_review',
      'completed',
      'approved',
      'archived',
      'failed',
      'rejected',
    ])
    .optional(),
  documentTypeKey: z.string().max(120).optional(),
  /** Restrict to reviewer-openable runs (needs_review + completed + approved). */
  openable: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(1000).default(50),
});
export class ListRunsQueryDto extends createZodDto(ListRunsQuerySchema) {}

/** Bulk-archive all archivable runs of a given classified type in a batch. */
const ArchiveTypeSchema = z.object({
  documentTypeKey: z.string().min(1).max(120),
  reason: z.string().max(300).optional(),
});
export class ArchiveTypeDto extends createZodDto(ArchiveTypeSchema) {}
