import { z } from 'zod';

/**
 * `kind` is now a free-form string that resolves against the DB-driven
 * VaultEntityKindConfig table (system rows seed the 7 defaults — person,
 * company, lawyer, court, case, property, other — and admins can add
 * org-specific kinds). Validation is shape-only here; existence is
 * enforced by the API when creating a VaultEntity.
 */
const kindKey = z
  .string()
  .min(1, 'Entity kind is required')
  .max(40)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores');

/** Create a vault entity. `fields` is a canonical key→value map (values are
 *  strings; the server encrypts the whole map at rest). */
export const createVaultEntitySchema = z.object({
  kind: kindKey.default('person'),
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

// ── Admin: configurable field catalog + doc kinds + entity kinds (docs/10) ─

// ── Signatures (docs/10): reusable, encrypted signatures saved per entity ──

export const vaultSignatureMethods = ['draw', 'upload', 'typed'] as const;

/**
 * Record a reusable signature against a vault entity. Mirrors the
 * document-signing capture payload (draw/upload → PNG data URL; typed → text +
 * font) and adds a user `label` + `isDefault`. The server encrypts the payload
 * at rest. Shared so the API (createZodDto) and the client validate identically.
 */
export const recordVaultSignatureSchema = z
  .object({
    method: z.enum(vaultSignatureMethods),
    label: z
      .string()
      .trim()
      .min(1, 'Give this signature a name')
      .max(80)
      .default('Signature'),
    /** data:image/…;base64,… for method 'draw' or 'upload'. ~2 MB cap. */
    image: z.string().startsWith('data:image/').max(2_000_000).optional(),
    /** The typed name for method 'typed'. */
    typedText: z.string().min(1).max(200).optional(),
    /** Font-family label used to render a typed signature. */
    font: z.string().max(120).optional(),
    /** Make this the entity's default signature. */
    isDefault: z.boolean().default(false),
  })
  .refine((v) => (v.method === 'typed' ? !!v.typedText : !!v.image), {
    message:
      'draw/upload signatures require an image; typed signatures require typedText',
  });
export type RecordVaultSignatureDto = z.infer<typeof recordVaultSignatureSchema>;

export const vaultFieldTypes = [
  'text', 'textarea', 'date', 'number', 'tel', 'email', 'select', 'lookup',
] as const;

export const vaultBadgeVariants = [
  'primary', 'secondary', 'info', 'warning', 'success',
] as const;

/**
 * Global field row. Belongs to no specific entity kind — many-to-many
 * linked via VaultEntityKindField. Key must stay stable (autofill keys to it).
 */
export const vaultFieldConfigSchema = z.object({
  id: z.string().optional(),
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
  isActive: z.boolean().default(true),
});
export type VaultFieldConfigDto = z.infer<typeof vaultFieldConfigSchema>;

/** Entity-kind row. */
export const vaultEntityKindConfigSchema = z.object({
  id: z.string().optional(),
  key: kindKey,
  label: z.string().min(1, 'Label is required').max(120),
  badgeVariant: z.enum(vaultBadgeVariants).default('secondary'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type VaultEntityKindConfigDto = z.infer<typeof vaultEntityKindConfigSchema>;

/** Replace-set body for kind → field links. Order in the array IS the
 *  display order — server assigns sortOrder by index. */
export const vaultEntityKindFieldsSchema = z.object({
  links: z
    .array(
      z.object({
        fieldId: z.string().min(1),
        groupOverride: z.string().max(60).nullish(),
        isActive: z.boolean().default(true),
      }),
    )
    .default([]),
});
export type VaultEntityKindFieldsDto = z.infer<typeof vaultEntityKindFieldsSchema>;

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
