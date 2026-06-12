import { z } from 'zod';

/**
 * Non-Disclosure Agreement (mutual or one-way), governed by the Indian Contract
 * Act, 1872. Structured so every field lives under a section prefix
 * (agreement / partyA / partyB / terms / governing / witnesses) — the builder
 * groups form fields by these prefixes.
 *
 * When `agreement.mutual` is true both parties disclose and receive; when
 * false, Party A is the Disclosing Party and Party B the Receiving Party. The
 * template branches its obligations language on this flag. No statutory section
 * numbers are authored here — an NDA's enforceability rests on the Contract Act
 * generally, not a cited section.
 */

const NdaPartySchema = z.object({
  name: z.string().min(1).max(200),
  entityType: z
    .enum([
      'individual',
      'company',
      'llp',
      'partnership',
      'proprietorship',
      'huf',
      'trust',
      'society',
      'other',
    ])
    .default('company'),
  address: z.string().max(500).optional(),
  /** Authorised signatory (for a non-individual party). */
  repName: z.string().max(200).optional(),
  repDesignation: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

const WitnessSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});

export const NdaAgreementSchema = z.object({
  mutual: z.boolean().default(true),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  place: z.string().max(120).optional(),
  purpose: z.string().min(1).max(1500),
});

export const NdaTermsSchema = z.object({
  /** What counts as Confidential Information (one item per line). */
  confidentialScope: z.array(z.string().min(1).max(500)).min(1).default(['']),
  /** Extra carve-outs beyond the standard exclusions baked into the template. */
  customExclusions: z.array(z.string().min(1).max(500)).optional(),
  /** Duration of the agreement itself, in months. */
  termMonths: z.coerce.number().int().min(1).max(600).default(24),
  /** How long confidentiality survives termination, in years (0 = perpetual). */
  survivalYears: z.coerce.number().int().min(0).max(50).default(3),
  permitDisclosureToReps: z.boolean().default(true),
  returnOrDestroy: z.boolean().default(true),
  injunctiveRelief: z.boolean().default(true),
});

export const NdaGoverningSchema = z.object({
  state: z.string().max(120).optional(),
  jurisdictionCity: z.string().max(120).optional(),
  disputeResolution: z.enum(['courts', 'arbitration']).default('courts'),
  arbitrationSeat: z.string().max(120).optional(),
});

export const NdaSchema = z.object({
  agreement: NdaAgreementSchema,
  partyA: NdaPartySchema,
  partyB: NdaPartySchema,
  terms: NdaTermsSchema,
  governing: NdaGoverningSchema,
  witnesses: z.array(WitnessSchema).max(4).optional(),
});

export type NdaData = z.infer<typeof NdaSchema>;
export type NdaParty = z.infer<typeof NdaPartySchema>;

/**
 * Loose variant for autosave of half-filled drafts: each top-level section is
 * optional (matching `Partial<NdaData>` so it satisfies the bundle's schema
 * generic). A present section is still validated against its full shape.
 */
export const NdaDraftSchema = NdaSchema.partial();
