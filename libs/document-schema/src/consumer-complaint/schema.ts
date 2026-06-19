import { z } from 'zod';

/**
 * Consumer complaint under the Consumer Protection Act, 2019 — a structured doc
 * type for a complaint filed before a Consumer Disputes Redressal Commission
 * (District / State / National).
 *
 * Statutory anchors (author-verified, see also `@org/legal-reference`):
 *   - §2(7): a "consumer" buys goods / avails services for consideration and
 *     NOT for resale or a commercial purpose (livelihood-by-self-employment is
 *     carved back in). Drives the eligibility check.
 *   - Pecuniary jurisdiction (per the Consumer Protection (Jurisdiction…) Rules,
 *     2021, keyed on the VALUE OF CONSIDERATION PAID — not the relief claimed):
 *       District ≤ ₹50,00,000 · State > ₹50,00,000 ≤ ₹2,00,00,000 · National > ₹2,00,00,000.
 *   - §34(2): territorial jurisdiction — file where the opposite party
 *     resides / carries on business / has a branch / works for gain, OR where
 *     the cause of action arose, OR where the complainant resides / works.
 *   - §69: a complaint must be filed within 2 years of the cause of action
 *     (condonable on sufficient cause).
 *   - §39: the reliefs a Commission may grant (refund, replacement, removal of
 *     defect/deficiency, compensation, discontinuance of an unfair trade
 *     practice, etc.). Filing section: §35 (District), §47 (State), §58 (National).
 *
 * This bundle authors NO section numbers in the form data; statutory text is
 * inserted deterministically by the template + `@org/legal-reference`.
 */

/** Pecuniary thresholds (paise-free rupees) per the 2021 jurisdiction rules. */
export const CPA_DISTRICT_MAX = 50_00_000; // ₹50 lakh
export const CPA_STATE_MAX = 2_00_00_000; // ₹2 crore

/** The Commission tier most appropriate for a given consideration value. */
export function recommendedForum(
  considerationPaid?: number,
): 'district' | 'state' | 'national' | null {
  if (considerationPaid == null || considerationPaid <= 0) return null;
  if (considerationPaid <= CPA_DISTRICT_MAX) return 'district';
  if (considerationPaid <= CPA_STATE_MAX) return 'state';
  return 'national';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateField = z.string().regex(ISO_DATE, 'YYYY-MM-DD');

export const ComplainantSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  occupation: z.string().max(200).optional(),
});

export const OppositePartySchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  /** e.g. "Manufacturer", "Seller", "Service provider", "E-commerce platform". */
  role: z.string().max(120).optional(),
});

export const ConsumerTransactionSchema = z.object({
  /** Date the goods were bought / the service was availed. */
  date: dateField.optional(),
  /** What was bought / availed. */
  description: z.string().min(1).max(2000),
  /** Consideration PAID — drives pecuniary jurisdiction (NOT the relief sought). */
  considerationPaid: z.coerce.number().int().min(1),
  /** Invoice / order / policy reference, if any. */
  reference: z.string().max(200).optional(),
});

export const ConsumerComplaintSchema = z.object({
  complaintDate: dateField,
  place: z.string().max(120).optional(),

  /** Commission tier. Cross-checked against `considerationPaid` by the risk rules. */
  forum: z.enum(['district', 'state', 'national']).default('district'),
  /** Full name of the Commission, e.g. "District Consumer Disputes Redressal Commission, Pune". */
  commissionName: z.string().max(300).optional(),

  complainant: ComplainantSchema,
  oppositeParties: z.array(OppositePartySchema).min(1),
  transaction: ConsumerTransactionSchema,

  /** Nature of the grievance — drives the framing of the cause of action. */
  grievanceType: z
    .enum([
      'defective_goods',
      'deficiency_in_service',
      'unfair_trade_practice',
      'overcharging',
      'hazardous_goods',
    ])
    .default('deficiency_in_service'),
  /** The defect / deficiency / unfair-trade-practice narrative. */
  grievance: z.string().min(1).max(4000),

  /** When the cause of action arose — drives the §69 2-year limitation check. */
  causeOfActionDate: dateField.optional(),
  /** Optional extra numbered facts. */
  facts: z.array(z.string().min(1).max(2000)).default([]),

  /** Reliefs prayed for — refund / replacement / removal of defect / etc. */
  reliefSought: z.array(z.string().min(1).max(500)).default([]),
  /** Compensation amount claimed (distinct from the consideration paid). */
  compensationClaimed: z.coerce.number().int().min(0).optional(),

  /** §2(7): goods/services bought for a commercial purpose are generally excluded. */
  purchasedForCommercialPurpose: z.boolean().default(false),
});

export type ConsumerComplaintData = z.infer<typeof ConsumerComplaintSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const ConsumerComplaintDraftSchema = ConsumerComplaintSchema.partial({
  complainant: true,
  oppositeParties: true,
  transaction: true,
  grievance: true,
}).extend({
  complaintDate: z.string().optional(),
});
