import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreateCommentSchema = z.object({
  body: z.string().min(1).max(4000),
  /** Optional anchor (section/field path); document-level if omitted. */
  anchor: z.record(z.string(), z.unknown()).optional(),
});
export class CreateCommentDto extends createZodDto(CreateCommentSchema) {}

const ResolveCommentSchema = z.object({
  resolved: z.boolean().default(true),
});
export class ResolveCommentDto extends createZodDto(ResolveCommentSchema) {}

/** Guest comment via a share token (no auth). */
const PublicCommentSchema = z.object({
  authorName: z.string().min(1).max(120),
  body: z.string().min(1).max(4000),
});
export class PublicCommentDto extends createZodDto(PublicCommentSchema) {}
