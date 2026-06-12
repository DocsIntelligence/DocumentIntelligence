import { z } from 'zod';

/**
 * Last Will & Testament — India (Indian Succession Act, 1925) and a generic
 * common-law will. Schedule-1 of the IT Act: NOT validly e-signable — must be
 * printed and signed by hand before two witnesses (gated via `isESignExcluded`
 * on the 'will' key). The AI authors no statutory text.
 * Sections: will / testator / executor / bequests / wishes / witnesses.
 */

export const WillMetaSchema = z.object({
  place: z.string().max(120).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  /** Revoke all earlier wills and codicils. */
  revokesPriorWills: z.boolean().default(true),
  /** Declaration of sound mind / free will. */
  soundMind: z.boolean().default(true),
});

export const WillTestatorSchema = z.object({
  name: z.string().min(1).max(200),
  /** S/o, D/o, W/o, C/o — from the party_relation lookup. */
  relation: z.string().max(8).optional(),
  parentName: z.string().max(200).optional(),
  age: z.coerce.number().int().min(18).max(120).optional(),
  occupation: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
});

export const WillExecutorSchema = z.object({
  name: z.string().min(1).max(200),
  relationship: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  alternateName: z.string().max(200).optional(),
  alternateAddress: z.string().max(500).optional(),
});

export const BequestSchema = z.object({
  beneficiary: z.string().min(1).max(200),
  relationship: z.string().max(120).optional(),
  description: z.string().min(1).max(800),
});

export const WillWishesSchema = z.object({
  residuaryBeneficiary: z.string().max(300).optional(),
  guardianName: z.string().max(200).optional(),
  guardianForMinors: z.string().max(300).optional(),
  funeralWishes: z.string().max(500).optional(),
});

export const WitnessSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});

export const WillSchema = z.object({
  will: WillMetaSchema,
  testator: WillTestatorSchema,
  executor: WillExecutorSchema,
  bequests: z.array(BequestSchema).min(1),
  wishes: WillWishesSchema,
  witnesses: z.array(WitnessSchema).min(2),
});

export type WillData = z.infer<typeof WillSchema>;
export type Bequest = z.infer<typeof BequestSchema>;
export type Witness = z.infer<typeof WitnessSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const WillDraftSchema = WillSchema.partial();
