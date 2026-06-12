import { z } from 'zod';

/**
 * Power of Attorney (General or Special), India. Governed by the
 * Powers-of-Attorney Act, 1882; often requires notarisation and, where it
 * concerns immovable property, registration. CANNOT be validly executed by
 * electronic signature (IT Act, 2000, Schedule 1) — the key
 * `power_of_attorney` is gated in `@org/legal-reference` schedule1.
 *
 * Sections: poa / principal / attorney / powers / terms / witnesses.
 */

const PoaPersonSchema = z.object({
  name: z.string().min(1).max(200),
  parentRelation: z.enum(['S/o', 'D/o', 'W/o', 'C/o']).optional(),
  parentName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  occupation: z.string().max(160).optional(),
});

const PoaAttorneySchema = PoaPersonSchema.extend({
  relationship: z.string().max(120).optional(),
});

const WitnessSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});

export const PoaMetaSchema = z.object({
  type: z.enum(['general', 'special']).default('special'),
  executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  place: z.string().max(120).optional(),
  registered: z.boolean().default(false),
});

export const PoaTermsSchema = z.object({
  purpose: z.string().max(1000).optional(),
  durationType: z.enum(['until_revoked', 'fixed']).default('until_revoked'),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
});

export const PowerOfAttorneySchema = z.object({
  poa: PoaMetaSchema,
  principal: PoaPersonSchema,
  attorney: PoaAttorneySchema,
  powers: z.array(z.string().min(1).max(500)).min(1).default(['']),
  terms: PoaTermsSchema,
  witnesses: z.array(WitnessSchema).max(3).optional(),
});

export type PowerOfAttorneyData = z.infer<typeof PowerOfAttorneySchema>;

/** Loose variant for autosave of half-filled drafts (top-level sections optional). */
export const PowerOfAttorneyDraftSchema = PowerOfAttorneySchema.partial();
