import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PageSize, DocumentStatus } from '@prisma/client';

const PageSizeEnum = z.nativeEnum(PageSize);
const DocumentStatusEnum = z.nativeEnum(DocumentStatus);

// ─── Create ────────────────────────────────────────────────────────────────

const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  documentTypeKey: z.string().min(1),
  templateKey: z.string().min(1),
  pageSize: PageSizeEnum.optional(),
  language: z.string().min(2).max(8).optional(),
  jurisdiction: z.string().min(2).max(16).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  ownerOrgId: z.string().cuid().optional(),
  /** When set, the new document is filed into this group on creation. */
  groupId: z.string().cuid().optional(),
});

export class CreateDocumentDto extends createZodDto(CreateDocumentSchema) {}

// ─── Patch (autosave) ──────────────────────────────────────────────────────

const PatchDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  pageSize: PageSizeEnum.optional(),
  language: z.string().min(2).max(8).optional(),
  jurisdiction: z.string().min(2).max(16).optional(),
  templateKey: z.string().min(1).optional(),
  status: DocumentStatusEnum.optional(),
});

export class PatchDocumentDto extends createZodDto(PatchDocumentSchema) {}

// ─── List query ────────────────────────────────────────────────────────────

const ListDocumentsQuerySchema = z.object({
  documentTypeKey: z.string().optional(),
  status: DocumentStatusEnum.optional(),
  orgId: z.string().cuid().optional(),
  groupId: z.string().optional(),
  /** Free-text search over the title (case-insensitive). */
  q: z.string().trim().max(200).optional(),
  /** 0-based page index for offset pagination. */
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  sort: z
    .enum(['title', 'type', 'status', 'updated', 'created'])
    .default('updated'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export class ListDocumentsQueryDto extends createZodDto(
  ListDocumentsQuerySchema,
) {}
