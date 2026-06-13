import { z } from 'zod';

/** Configurable search settings (org-scoped). Shared by the admin form
 *  (react-hook-form) and the server (createZodDto). All fields optional so the
 *  admin can PATCH a subset. */
export const searchConfigSchema = z.object({
  keywordWeight: z
    .number({ error: 'Enter a number' })
    .min(0, 'Must be ≥ 0')
    .max(1, 'Must be ≤ 1')
    .optional(),
  semanticWeight: z
    .number({ error: 'Enter a number' })
    .min(0, 'Must be ≥ 0')
    .max(1, 'Must be ≤ 1')
    .optional(),
  semanticEnabled: z.boolean().optional(),
  enabledKinds: z
    .array(z.enum(['document', 'source']))
    .min(1, 'Enable at least one kind')
    .optional(),
  fuzzyThreshold: z
    .number({ error: 'Enter a number' })
    .min(0, 'Must be ≥ 0')
    .max(1, 'Must be ≤ 1')
    .optional(),
  recencyWeight: z
    .number({ error: 'Enter a number' })
    .min(0, 'Must be ≥ 0')
    .max(1, 'Must be ≤ 1')
    .optional(),
  snippetWords: z
    .number({ error: 'Enter a number' })
    .int('Whole number')
    .min(10, 'Min 10')
    .max(80, 'Max 80')
    .optional(),
  embeddingModel: z.string().min(1).max(120).optional(),
  maxResults: z
    .number({ error: 'Enter a number' })
    .int('Whole number')
    .min(10, 'Min 10')
    .max(1000, 'Max 1000')
    .optional(),
});

export type SearchConfigDto = z.infer<typeof searchConfigSchema>;
