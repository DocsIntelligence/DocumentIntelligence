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
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
});

export class ListDocumentsQueryDto extends createZodDto(
  ListDocumentsQuerySchema,
) {}
