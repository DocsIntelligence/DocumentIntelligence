import { z } from 'zod';

/** Maps an extraction schema's field keys → a drafting type's nested paths. */
export const fieldMapSchema = z.object({
  documentTypeKey: z
    .string()
    .min(1, 'Drafting type key is required')
    .max(120, 'Type key is too long'),
  mapping: z.record(z.string(), z.string()),
});
export type FieldMapDto = z.infer<typeof fieldMapSchema>;
