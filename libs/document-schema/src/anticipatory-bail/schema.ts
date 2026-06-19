import { z } from 'zod';

/**
 * Anticipatory-bail application under Section 482 of the Bharatiya Nagarik
 * Suraksha Sanhita, 2023 (BNSS) — pre-arrest bail, the successor to CrPC §438.
 *
 * Statutory anchors (author-verified, see also `@org/legal-reference`):
 *   - BNSS §482: where a person apprehends arrest for a NON-bailable offence,
 *     the High Court or the Court of Session may direct release on bail in the
 *     event of arrest, and may impose conditions (§482(2)). ⚠️ Renumbering trap:
 *     under the old CrPC, §482 was the High Court's inherent powers — under BNSS
 *     anticipatory bail is §482 and inherent powers moved to §528.
 *   - The application lies ONLY before the Court of Session or the High Court.
 *   - An FIR need not yet be registered — a reasonable apprehension of arrest is
 *     enough — so the FIR fields are optional but the apprehension is mandatory.
 *
 * This bundle authors NO statutory section numbers in the form data; statutory
 * text is inserted deterministically by the template + `@org/legal-reference`.
 * The "offences alleged" the applicant enters are copied from the FIR — they are
 * descriptive, not authored by us.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateField = z.string().regex(ISO_DATE, 'YYYY-MM-DD');

export const BailAdvocateSchema = z.object({
  name: z.string().max(200).optional(),
  enrollmentNo: z.string().max(60).optional(),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
});

/** The applicant = the person apprehending arrest (the proposed accused). */
export const ApplicantSchema = z.object({
  name: z.string().min(1).max(200),
  /** "s/o, d/o, w/o …" — parentage as it should read in the cause-title. */
  guardianName: z.string().max(200).optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  occupation: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
});

export const FirSchema = z.object({
  number: z.string().max(60).optional(),
  date: dateField.optional(),
  policeStation: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
});

export const AnticipatoryBailSchema = z.object({
  applicationDate: dateField,
  place: z.string().max(120).optional(),

  /** Forum: anticipatory bail lies only before the Sessions Court or High Court. */
  court: z.enum(['sessions', 'high_court']).default('sessions'),
  /** Full court name, e.g. "Court of Session, Pune" / "High Court of Bombay". */
  courtName: z.string().max(300).optional(),
  /** State, for the cause-title / jurisdiction line (respondent is the State). */
  state: z.string().max(120).optional(),

  applicant: ApplicantSchema,
  fir: FirSchema.optional(),

  /** Offences alleged (copied from the FIR) — descriptive, e.g. "BNS §318(4)". */
  offences: z.array(z.string().min(1).max(200)).default([]),
  /** Whether the alleged offences are non-bailable (anticipatory bail premise). */
  offenceIsNonBailable: z.boolean().default(true),

  /** Why the applicant reasonably apprehends arrest — the core of a §482 plea. */
  apprehensionGrounds: z.string().min(1).max(4000),
  /** Grounds urged for grant of anticipatory bail (false implication, etc.). */
  groundsForBail: z.array(z.string().min(1).max(1000)).default([]),

  /** Applicant has clean antecedents (no prior involvement). */
  cleanAntecedents: z.boolean().default(true),
  /** Applicant undertakes to cooperate with the investigation. */
  willingToCooperate: z.boolean().default(true),
  /** Custodial interrogation is not warranted (a standard plea). */
  custodyNotRequired: z.boolean().default(true),

  /** Conditions the applicant offers to abide by (§482(2)). */
  proposedConditions: z.array(z.string().min(1).max(500)).default([]),

  advocate: BailAdvocateSchema.optional(),
});

export type AnticipatoryBailData = z.infer<typeof AnticipatoryBailSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const AnticipatoryBailDraftSchema = AnticipatoryBailSchema.partial({
  applicant: true,
  apprehensionGrounds: true,
  advocate: true,
}).extend({
  applicationDate: z.string().optional(),
});
