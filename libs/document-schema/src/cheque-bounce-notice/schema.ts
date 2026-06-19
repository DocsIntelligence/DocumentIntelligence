import { z } from 'zod';

/**
 * §138 NI Act cheque-bounce demand notice — a focused, first-class structured
 * doc type (distinct from the generic `legal_notice`, which carries a cheque
 * branch but doesn't guide the full statutory timeline).
 *
 * Statutory anchors (author-verified, see also `@org/legal-reference`):
 *   - NI Act 1881 §138: cheque dishonour is an offence only if (a) the cheque
 *     was for a legally enforceable debt/liability, (b) a written DEMAND is made
 *     within 30 days of the bank's return memo, and (c) the drawer is given
 *     15 days from RECEIPT of the demand to pay.
 *   - §141: when the drawer is a company/firm, the persons in charge of its
 *     business at the time are also liable (cite + name them).
 *   - §142: cognizance only on the payee's written complaint, filed within one
 *     month of the cause of action (i.e. lapse of the 15-day payment window).
 *
 * This bundle authors NO section numbers in the form data; statutory text is
 * inserted deterministically by the template + `@org/legal-reference`.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateField = z.string().regex(ISO_DATE, 'YYYY-MM-DD');

const PartySchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
});

export const ChequeAdvocateSchema = z.object({
  name: z.string().max(200).optional(),
  enrollmentNo: z.string().max(60).optional(),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
});

/** Drawer = the person/entity that issued the dishonoured cheque (the noticee). */
export const DrawerSchema = PartySchema.extend({
  /** Drives §141 officer-in-default liability framing. */
  isCompany: z.boolean().default(false),
  /** Persons in charge of the company's business (§141) — named when isCompany. */
  officers: z.array(z.string().min(1).max(200)).default([]),
});

export const ChequeParticularsSchema = z.object({
  number: z.string().min(1).max(20),
  amount: z.coerce.number().int().min(1),
  bankName: z.string().min(1).max(200),
  branch: z.string().max(200).optional(),
  /** Date written on the cheque. */
  chequeDate: dateField.optional(),
  /** Date the payee presented the cheque for collection. */
  presentedDate: dateField.optional(),
  /** Date of the bank's dishonour / return memo (starts the 30-day clock). */
  dishonourDate: dateField.optional(),
  /** Reason printed on the return memo (e.g. "Funds insufficient"). */
  dishonourReason: z.string().max(200).optional(),
});

export const ChequeBounceNoticeSchema = z.object({
  noticeDate: dateField,
  place: z.string().max(120).optional(),
  deliveryMode: z
    .enum(['registered_post_ad', 'speed_post', 'courier', 'email', 'hand'])
    .default('registered_post_ad'),
  throughAdvocate: z.boolean().default(true),
  advocate: ChequeAdvocateSchema.optional(),

  /** Payee / holder in due course — the complainant on whose behalf the notice issues. */
  payee: PartySchema,
  drawer: DrawerSchema,
  cheque: ChequeParticularsSchema,

  /** What the cheque was issued towards — the legally enforceable debt/liability. */
  underlyingLiability: z.string().min(1).max(2000),
  /** Optional extra background paragraphs. */
  facts: z.array(z.string().min(1).max(2000)).default([]),

  /** Amount demanded (normally the cheque amount; may add costs). */
  demandAmount: z.coerce.number().int().min(1),
  /** Days the drawer is given to pay from receipt — statutory minimum 15. */
  complianceDays: z.coerce.number().int().min(15).max(90).default(15),
});

export type ChequeBounceNoticeData = z.infer<typeof ChequeBounceNoticeSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const ChequeBounceNoticeDraftSchema = ChequeBounceNoticeSchema.partial({
  advocate: true,
  payee: true,
  drawer: true,
  cheque: true,
  underlyingLiability: true,
  demandAmount: true,
}).extend({
  noticeDate: z.string().optional(),
});
