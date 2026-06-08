import { z } from 'zod';

/**
 * Pre-litigation Legal Notice schema. One component with a `noticeType` branch
 * (cheque bounce / consumer / civil recovery / employment / general). Sections:
 *   - meta: notice type, delivery mode, through-advocate
 *   - advocate: issuing advocate (optional — notice may be self-sent)
 *   - sender: the client on whose behalf the notice is issued
 *   - recipient: the noticee
 *   - content: subject, facts, demand, cause of action
 *   - cheque: dishonoured-cheque particulars (cheque-bounce only)
 *
 * Statutory anchors (author-verified): Negotiable Instruments Act 1881 §138
 * (15-day demand on the drawer after receipt; complaint window under §142),
 * Consumer Protection Act 2019, CPC §80 (60-day notice for suits vs government).
 */

const PersonSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
});

export const NoticeAdvocateSchema = z.object({
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

export const NoticeChequeSchema = z.object({
  number: z.string().max(20).optional(),
  amount: z.coerce.number().int().min(0).optional(),
  bankName: z.string().max(200).optional(),
  chequeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  presentedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  dishonourDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  dishonourReason: z.string().max(200).optional(),
});

export const NoticeContentSchema = z.object({
  subject: z.string().min(1).max(300),
  facts: z.array(z.string().min(1).max(2000)).min(1).default(['']),
  demandText: z.string().max(2000).optional(),
  demandAmount: z.coerce.number().int().min(0).optional(),
  complianceDays: z.coerce.number().int().min(1).max(180).default(15),
  causeOfActionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  causeOfActionPlace: z.string().max(120).optional(),
});

// ─── Top-level ───────────────────────────────────────────────────────────

export const LegalNoticeSchema = z.object({
  noticeType: z
    .enum([
      'cheque_bounce',
      'consumer',
      'civil_recovery',
      'employment',
      'general',
    ])
    .default('general'),
  deliveryMode: z
    .enum(['registered_post_ad', 'email', 'courier', 'hand'])
    .default('registered_post_ad'),
  throughAdvocate: z.boolean().default(true),
  place: z.string().max(120).optional(),
  noticeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  advocate: NoticeAdvocateSchema.optional(),
  sender: PersonSchema,
  recipient: PersonSchema,
  content: NoticeContentSchema,
  cheque: NoticeChequeSchema.optional(),
});

export type LegalNoticeData = z.infer<typeof LegalNoticeSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const LegalNoticeDraftSchema = LegalNoticeSchema.partial({
  advocate: true,
  sender: true,
  recipient: true,
  content: true,
  cheque: true,
}).extend({
  noticeDate: z.string().optional(),
});
