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
