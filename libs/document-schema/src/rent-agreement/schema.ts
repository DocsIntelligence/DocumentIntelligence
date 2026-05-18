import { z } from 'zod';

/**
 * Rent agreement schema. Sections:
 *   - parties: landlord + tenant (each with name, parent, age, occupation, address, contact)
 *   - property: full premises description, type, furnished status
 *   - term: start date, duration (months), renewal allowed
 *   - rent_deposit: monthly rent, deposit, escalation, due day
 *   - utilities: who pays what
 *   - rules: pets, sublet, alterations, lock-in
 *   - witnesses: two witnesses with name + address
 *
 * Jurisdiction context (state) lives at the top level — clauses and risks
 * branch off it. ISO 3166-2:IN codes (e.g. "IN-MH", "IN-KA").
 *
 * Keep the schema permissive enough to allow autosave of partial drafts;
 * the strict validation happens when status transitions to "ready" or the
 * user requests a PDF export.
 */

// ─── Re-usable atoms ─────────────────────────────────────────────────────

export const PartySchema = z.object({
  name: z.string().min(1).max(200),
  parentName: z.string().max(200).optional(), // "S/o", "D/o", "W/o"
  parentRelation: z.enum(['S/o', 'D/o', 'W/o']).optional(),
  age: z.coerce.number().int().min(18).max(120).optional(),
  occupation: z.string().max(120).optional(),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN')
    .optional()
    .or(z.literal('')),
  aadhaarMasked: z
    .string()
    .regex(/^X{4}\sX{4}\s[0-9]{4}$/, 'Use masked Aadhaar e.g. XXXX XXXX 1234')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
});

export type Party = z.infer<typeof PartySchema>;

export const WitnessSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
});

export const PropertySchema = z.object({
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(120),
  state: z.string().min(2).max(40),
  pincode: z
    .string()
    .regex(/^[1-9][0-9]{5}$/, 'Invalid pincode')
    .optional()
    .or(z.literal('')),
  type: z
    .enum(['apartment', 'independent_house', 'villa', 'commercial', 'pg_room'])
    .default('apartment'),
  builtUpAreaSqft: z.coerce.number().int().min(0).max(100000).optional(),
  furnished: z
    .enum(['unfurnished', 'semi_furnished', 'fully_furnished'])
    .default('unfurnished'),
  inventory: z.array(z.string().max(200)).default([]),
});

export const TermSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  durationMonths: z.coerce.number().int().min(1).max(120).default(11),
  renewable: z.boolean().default(true),
  noticePeriodDays: z.coerce.number().int().min(0).max(180).default(30),
  lockInMonths: z.coerce.number().int().min(0).max(60).default(0),
});

export const RentDepositSchema = z.object({
  rentMonthly: z.coerce.number().int().min(0),
  rentDueDay: z.coerce.number().int().min(1).max(31).default(5),
  depositAmount: z.coerce.number().int().min(0),
  depositReturnDays: z.coerce.number().int().min(0).max(180).default(30),
  escalationPercent: z.coerce.number().min(0).max(100).default(0),
  escalationEveryMonths: z.coerce.number().int().min(0).max(60).default(12),
  lateFeePerDay: z.coerce.number().int().min(0).default(0),
});

export const UtilitiesSchema = z.object({
  electricityPaidBy: z.enum(['landlord', 'tenant', 'shared']).default('tenant'),
  waterPaidBy: z.enum(['landlord', 'tenant', 'shared']).default('tenant'),
  maintenancePaidBy: z
    .enum(['landlord', 'tenant', 'shared'])
    .default('landlord'),
  internetPaidBy: z.enum(['landlord', 'tenant', 'shared']).default('tenant'),
  societyChargesPaidBy: z
    .enum(['landlord', 'tenant', 'shared'])
    .default('landlord'),
  propertyTaxPaidBy: z
    .enum(['landlord', 'tenant', 'shared'])
    .default('landlord'),
});

export const RulesSchema = z.object({
  petsAllowed: z.boolean().default(false),
  subletAllowed: z.boolean().default(false),
  alterationsAllowed: z.boolean().default(false),
  smokingAllowed: z.boolean().default(false),
  maxOccupants: z.coerce.number().int().min(1).max(20).default(4),
  commercialUseAllowed: z.boolean().default(false),
  customRules: z.array(z.string().max(500)).default([]),
});

// ─── Top-level ───────────────────────────────────────────────────────────

export const RentAgreementSchema = z.object({
  state: z
    .string()
    .regex(/^IN-[A-Z]{2}$/, 'Use ISO 3166-2:IN code e.g. IN-MH')
    .default('IN-MH'),
  city: z.string().max(120).optional(),
  executionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  registered: z.boolean().default(false),
  registrationOffice: z.string().max(200).optional(),
  parties: z.object({
    landlord: PartySchema,
    tenant: PartySchema,
  }),
  property: PropertySchema,
  term: TermSchema,
  rent_deposit: RentDepositSchema,
  utilities: UtilitiesSchema,
  rules: RulesSchema,
  witnesses: z.array(WitnessSchema).max(4).default([]),
});

export type RentAgreementData = z.infer<typeof RentAgreementSchema>;

/**
 * A loose schema variant used during autosave — every section becomes
 * partial so half-typed drafts validate. The strict `RentAgreementSchema`
 * is used at "ready"/"export" gates.
 */
export const RentAgreementDraftSchema = RentAgreementSchema.partial({
  parties: true,
  property: true,
  term: true,
  rent_deposit: true,
  utilities: true,
  rules: true,
  witnesses: true,
}).extend({
  executionDate: z.string().optional(),
});
