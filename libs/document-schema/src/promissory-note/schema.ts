import { z } from 'zod';

/**
 * Promissory Note — an unconditional written promise to pay a sum of money,
 * a "negotiable instrument" under §4 of the Negotiable Instruments Act, 1881.
 *
 * Two legal cautions enforced via risks (not the template):
 *  - it must bear the requisite stamp under the Indian Stamp Act (an unstamped
 *    note is inadmissible in evidence); and
 *  - it CANNOT be validly executed by electronic signature (IT Act, 2000,
 *    Schedule 1 excludes negotiable instruments other than cheques) — the key
 *    `promissory_note` is gated in `@org/legal-reference` schedule1.
 *
 * Every field sits under a section prefix (note / maker / payee / witnesses).
 */

const PromissoryPartySchema = z.object({
  name: z.string().min(1).max(200),
  parentRelation: z.enum(['S/o', 'D/o', 'W/o', 'C/o']).optional(),
  parentName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
});

const WitnessSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});

export const PromissoryNoteDetailsSchema = z.object({
  place: z.string().max(120).optional(),
  noteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  principalAmount: z.coerce.number().int().min(1),
  /** Simple interest, % per annum. Omit / 0 for an interest-free note. */
  interestRate: z.coerce.number().min(0).max(100).optional(),
  payableOn: z.enum(['demand', 'fixed_date']).default('demand'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  /** What the maker received for the promise (e.g. "a hand loan"). */
  consideration: z.string().max(500).optional(),
  onStampPaper: z.boolean().default(false),
});

export const PromissoryNoteSchema = z.object({
  note: PromissoryNoteDetailsSchema,
  maker: PromissoryPartySchema,
  payee: PromissoryPartySchema,
  witnesses: z.array(WitnessSchema).max(2).optional(),
});

export type PromissoryNoteData = z.infer<typeof PromissoryNoteSchema>;
export type PromissoryParty = z.infer<typeof PromissoryPartySchema>;

/** Loose variant for autosave of half-filled drafts (top-level sections optional). */
export const PromissoryNoteDraftSchema = PromissoryNoteSchema.partial();
