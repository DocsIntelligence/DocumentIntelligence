import { z } from 'zod';

/**
 * Employment Offer Letter — works for the Indian market and globally. Currency
 * and an optional "at-will" flag make it usable outside India; when the
 * jurisdiction is Indian, at-will should stay off (Indian employment is not
 * at-will). No statutory citations are authored — terms are contractual.
 *
 * Every field sits under a section prefix:
 *   offer / company / candidate / role / compensation / terms
 */

export const OfferMetaSchema = z.object({
  letterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  place: z.string().max(120).optional(),
});

export const OfferCompanySchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  signatoryName: z.string().max(200).optional(),
  signatoryDesignation: z.string().max(160).optional(),
});

export const OfferCandidateSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

export const OfferRoleSchema = z.object({
  title: z.string().min(1).max(160),
  department: z.string().max(160).optional(),
  reportingTo: z.string().max(160).optional(),
  location: z.string().max(160).optional(),
  employmentType: z
    .enum(['full_time', 'part_time', 'contract', 'internship'])
    .default('full_time'),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  probationMonths: z.coerce.number().int().min(0).max(24).optional(),
});

export const OfferCompensationSchema = z.object({
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']).default('INR'),
  annualCtc: z.coerce.number().min(0),
  payFrequency: z.enum(['monthly', 'annual']).default('monthly'),
  breakup: z.string().max(1000).optional(),
  variablePay: z.string().max(500).optional(),
});

export const OfferTermsSchema = z.object({
  noticePeriodDays: z.coerce.number().int().min(0).max(365).default(30),
  workingHours: z.string().max(200).optional(),
  confidentiality: z.boolean().default(true),
  ipAssignment: z.boolean().default(true),
  backgroundCheck: z.boolean().default(true),
  atWill: z.boolean().default(false),
  acceptBy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
});

export const EmploymentOfferSchema = z.object({
  offer: OfferMetaSchema,
  company: OfferCompanySchema,
  candidate: OfferCandidateSchema,
  role: OfferRoleSchema,
  compensation: OfferCompensationSchema,
  terms: OfferTermsSchema,
});

export type EmploymentOfferData = z.infer<typeof EmploymentOfferSchema>;

/** Loose variant for autosave of half-filled drafts (top-level sections optional). */
export const EmploymentOfferDraftSchema = EmploymentOfferSchema.partial();
