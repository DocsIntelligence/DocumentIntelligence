import { z } from 'zod';

/** Draft a whole document as editor-ready HTML from a natural-language brief. */
export const generateDocumentSchema = z.object({
  brief: z
    .string()
    .trim()
    .min(1, 'Describe the document you need')
    .max(10000, 'Brief is too long (max 6000 characters)'),
  /** Optional — grounds the draft in a known document type's sections. */
  documentTypeKey: z.string().min(1).optional(),
  title: z.string().max(200).optional(),
  /** Human language name to write the document in (e.g. "English", "Hindi"). */
  language: z.string().min(2).max(40).default('English'),
  /** Optional court/legal preset key (see @org/legal-reference). */
  presetKey: z.string().min(1).max(64).optional(),
});
export type GenerateDocumentDto = z.infer<typeof generateDocumentSchema>;

/** The fields the Draft-with-AI form actually edits. */
export const draftAiFormSchema = generateDocumentSchema.pick({
  brief: true,
  language: true,
});
export type DraftAiFormValues = z.infer<typeof draftAiFormSchema>;
