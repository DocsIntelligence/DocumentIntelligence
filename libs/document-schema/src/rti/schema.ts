import { z } from 'zod';

/**
 * RTI Application schema (Right to Information Act, 2005). Sections:
 *   - applicant: citizen filing the application
 *   - authority: the public authority + department addressed
 *   - pio: Public Information Officer details (often unknown — optional)
 *   - request: subject + the specific information points + optional period
 *   - fee: application fee (₹10 Central; BPL applicants exempt)
 *
 * Statutory anchors (author-verified; re-check periodically):
 *   - §6(1) right to request   - §6(3) transfer to correct authority (5 days)
 *   - §7(1) reply within 30 days (48 hours where life/liberty is involved)
 *   - §7(5) proviso / RTI Rules — no fee for BPL applicants
 *   - §19 first appeal within 30 days
 *
 * Permissive enough to autosave partial drafts; strict gate runs on
 * "ready"/export.
 */

export const RtiApplicantSchema = z.object({
  name: z.string().min(1).max(200),
  parentRelation: z.enum(['S/o', 'D/o', 'W/o']).optional(),
  parentName: z.string().max(200).optional(),
  address: z.string().min(1).max(500),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  isBPL: z.boolean().default(false),
});

export const RtiAuthoritySchema = z.object({
  publicAuthority: z.string().min(1).max(200),
  department: z.string().max(200).optional(),
  officeAddress: z.string().max(500).optional(),
  state: z
    .string()
    .regex(/^IN-[A-Z*]{1,2}$/, 'Use ISO 3166-2:IN code e.g. IN-DL')
    .default('IN-*'),
});

export const RtiPioSchema = z.object({
  name: z.string().max(200).optional(),
  designation: z.string().max(200).optional(),
});

export const RtiRequestSchema = z.object({
  subject: z.string().min(1).max(300),
  questions: z.array(z.string().min(1).max(1000)).min(1).default(['']),
  periodFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  periodTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  preferredFormat: z
    .enum(['certified_copies', 'inspection', 'soft_copy', 'sample'])
    .default('certified_copies'),
  lifeOrLiberty: z.boolean().default(false),
});

export const RtiFeeSchema = z.object({
  amount: z.coerce.number().int().min(0).default(10),
  mode: z
    .enum(['ipo', 'dd', 'court_fee_stamp', 'cash', 'online'])
    .default('ipo'),
  paid: z.boolean().default(false),
});

// ─── Top-level ───────────────────────────────────────────────────────────

export const RtiApplicationSchema = z.object({
  place: z.string().max(120).optional(),
  applicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  applicant: RtiApplicantSchema,
  authority: RtiAuthoritySchema,
  pio: RtiPioSchema.optional(),
  request: RtiRequestSchema,
  fee: RtiFeeSchema,
});

export type RtiApplicationData = z.infer<typeof RtiApplicationSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const RtiApplicationDraftSchema = RtiApplicationSchema.partial({
  applicant: true,
  authority: true,
  pio: true,
  request: true,
  fee: true,
}).extend({
  applicationDate: z.string().optional(),
});
