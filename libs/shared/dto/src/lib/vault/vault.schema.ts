import { z } from 'zod';

export const vaultEntityKinds = ['person', 'company', 'other'] as const;

/** Create a vault entity. `fields` is a canonical key→value map (values are
 *  strings; the server encrypts the whole map at rest). */
export const createVaultEntitySchema = z.object({
  kind: z.enum(vaultEntityKinds).default('person'),
  label: z.string().min(1, 'Give this entity a name').max(120, 'Too long'),
  fields: z.record(z.string(), z.string()).default({}),
});
export type CreateVaultEntityDto = z.infer<typeof createVaultEntitySchema>;

/** Update a vault entity — any subset. `fields`, when present, replaces the set. */
export const updateVaultEntitySchema = z.object({
  label: z.string().min(1).max(120).optional(),
  fields: z.record(z.string(), z.string()).optional(),
});
export type UpdateVaultEntityDto = z.infer<typeof updateVaultEntitySchema>;
