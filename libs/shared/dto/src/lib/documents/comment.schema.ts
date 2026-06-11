import { z } from 'zod';

/** Add a comment to a document (shared client + server). */
export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write a comment')
    .max(4000, 'Comment is too long (max 4000 characters)'),
  /** Optional anchor (section/field path); document-level if omitted. */
  anchor: z.record(z.string(), z.unknown()).optional(),
});
export type CreateCommentDto = z.infer<typeof createCommentSchema>;
