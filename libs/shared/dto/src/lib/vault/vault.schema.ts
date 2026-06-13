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
  isActive: z.boolean().optional(),
});
export type UpdateVaultEntityDto = z.infer<typeof updateVaultEntitySchema>;

// ── Admin: configurable field catalog + doc kinds (docs/10) ─────────────────

export const vaultFieldTypes = [
  'text', 'textarea', 'date', 'number', 'tel', 'email', 'select', 'lookup',
] as const;

export const vaultFieldConfigSchema = z.object({
  id: z.string().optional(),
  entityKind: z.enum(vaultEntityKinds),
  key: z
    .string()
    .min(1, 'Key is required')
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores'),
  label: z.string().min(1, 'Label is required').max(120),
  type: z.enum(vaultFieldTypes).default('text'),
  group: z.string().max(40).nullish(),
  options: z.array(z.string()).default([]),
  lookupKey: z.string().max(120).nullish(),
  sensitive: z.boolean().default(false),
  revealLast: z.number().int().min(0).max(8).nullish(),
  placeholder: z.string().max(120).nullish(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type VaultFieldConfigDto = z.infer<typeof vaultFieldConfigSchema>;

export const vaultDocKindConfigSchema = z.object({
  id: z.string().optional(),
  kind: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores'),
  label: z.string().min(1).max(120),
  fills: z.array(z.string()).default([]),
  scannable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type VaultDocKindConfigDto = z.infer<typeof vaultDocKindConfigSchema>;
