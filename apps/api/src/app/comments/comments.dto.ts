import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { createCommentSchema } from '@org/dto';

// Validation shared with the client via `@org/dto` (single source of truth).
export class CreateCommentDto extends createZodDto(createCommentSchema) {}

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
