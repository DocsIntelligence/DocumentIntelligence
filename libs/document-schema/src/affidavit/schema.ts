import { z } from 'zod';

/**
 * General-purpose affidavit schema (a sworn/affirmed written declaration).
 * One flexible type covers the common Indian uses — name/address/date-of-birth
 * declarations, income, gap/relationship, lost-document, etc. — via a free list
 * of numbered statements rather than a per-use template (anti-bloat).
 *
 * Sections:
 *   - deponent: the person swearing the affidavit
 *   - declaration: title/purpose + the numbered statements (the substance)
 *   - attestation: before whom it is sworn (notary / oath commissioner / …)
 *
 * Legal note: affidavits are sworn/affirmed declarations; a false affidavit is
 * a punishable offence (giving false evidence / false statement in a
 * declaration). The exact statutory section (now under the Bharatiya Nyaya
 * Sanhita, 2023, which replaced the IPC 1860) is intentionally NOT hardcoded —
 * it must be resolved/verified via `@org/legal-reference`, never authored here.
 *
 * Permissive enough to autosave partial drafts; the strict gate runs on
 * "ready"/export.
 */

export const AffidavitDeponentSchema = z.object({
  name: z.string().min(1).max(200),
  parentRelation: z.enum(['S/o', 'D/o', 'W/o', 'C/o']).optional(),
  parentName: z.string().max(200).optional(),
  age: z.coerce.number().int().min(1).max(120).optional(),
  occupation: z.string().max(200).optional(),
  address: z.string().min(1).max(500),
  idType: z
    .enum(['aadhaar', 'pan', 'passport', 'voter_id', 'driving_licence', 'none'])
    .default('none'),
  idNumber: z.string().max(50).optional(),
});

export const AffidavitDeclarationSchema = z.object({
  /** e.g. "Affidavit for Change of Name". Optional — defaults to "AFFIDAVIT". */
  title: z.string().max(200).optional(),
  /** e.g. "submission to the Regional Passport Office, New Delhi". */
  purpose: z.string().max(300).optional(),
  statements: z.array(z.string().min(1).max(2000)).min(1).default(['']),
});

export const AffidavitAttestationSchema = z.object({
  type: z
    .enum([
      'notary',
      'oath_commissioner',
      'executive_magistrate',
      'self_attested',
    ])
    .default('notary'),
});

// ─── Top-level ───────────────────────────────────────────────────────────

export const AffidavitSchema = z.object({
  place: z.string().max(120).optional(),
  affidavitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  deponent: AffidavitDeponentSchema,
  declaration: AffidavitDeclarationSchema,
  attestation: AffidavitAttestationSchema,
});

export type AffidavitData = z.infer<typeof AffidavitSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const AffidavitDraftSchema = AffidavitSchema.partial({
  deponent: true,
  declaration: true,
  attestation: true,
}).extend({
  affidavitDate: z.string().optional(),
});
