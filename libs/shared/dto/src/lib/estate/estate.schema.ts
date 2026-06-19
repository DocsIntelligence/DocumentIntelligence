import { z } from 'zod';
import { ASSET_CLASSES } from './asset-fields';

/**
 * Estate & Wealth Vault contracts (docs/13). Shared Zod schemas so the React
 * forms (react-hook-form) and the NestJS API (createZodDto) validate the exact
 * same shape. Monetary values cross the wire in MAJOR units (e.g. rupees) as a
 * number for UX; the server converts to/from minor-unit integers for storage.
 */

/** Free-form asset-type key, resolved against the EstateVaultConfig catalog. */
const assetTypeKey = z
  .string()
  .min(1, 'Asset type is required')
  .max(40)
  .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores');

const currencyCode = z
  .string()
  .length(3, 'Use a 3-letter currency code')
  .regex(/^[A-Z]{3}$/, 'Use a 3-letter ISO code (e.g. INR)')
  .default('INR');

/** A monetary amount in major units (e.g. ₹) — non-negative, 2 dp. */
const money = z
  .number({ error: 'Enter an amount' })
  .nonnegative('Amount cannot be negative')
  .finite();

/** Quantity held (MF/ETF units, demat shares, grams of gold) — fractional ok. */
const units = z
  .number({ error: 'Enter a quantity' })
  .nonnegative('Quantity cannot be negative')
  .finite();

export const assetStatuses = ['active', 'matured', 'closed'] as const;

/**
 * Per-asset-type structured fields — a flat map of non-secret values whose
 * shape is driven by the app's static per-type registry (e.g. FD interestRate,
 * insurance sumAssured/validTill, MF fundHouse). Values are scalars; the server
 * persists this as-is to `Asset.details`. Bounded to keep the blob sane.
 */
const assetDetails = z
  .record(
    z.string().max(64),
    z.union([z.string().max(500), z.number(), z.boolean()]),
  )
  .refine((o) => Object.keys(o).length <= 40, 'Too many detail fields');

/** Create an asset. `identifier` (account/folio/policy no.) is encrypted server-side. */
export const createAssetSchema = z.object({
  type: assetTypeKey.default('other'),
  label: z.string().min(1, 'Give this asset a name').max(160, 'Too long'),
  institution: z.string().max(160).optional(),
  currency: currencyCode,
  /** Current value in major units. Optional — an asset can be logged before valuing. */
  value: money.optional(),
  /** Units/shares/grams held — only for unit-bearing types (config `tracksUnits`). */
  units: units.optional(),
  /** Full account/folio/policy number — stored encrypted, shown masked. */
  identifier: z.string().max(120).optional(),
  /** ISO date (yyyy-mm-dd) — maturity for FD/bond/insurance/PPF. */
  maturityDate: z.string().date().optional(),
  status: z.enum(assetStatuses).default('active'),
  notes: z.string().max(2000).optional(),
  /** Per-type structured detail fields (see {@link assetDetails}). */
  details: assetDetails.optional(),
});
export type CreateAssetDto = z.infer<typeof createAssetSchema>;

/** Bulk-create assets (e.g. importing all holdings from one CAS statement). */
export const bulkCreateAssetsSchema = z.object({
  assets: z.array(createAssetSchema).min(1).max(200),
});
export type BulkCreateAssetsDto = z.infer<typeof bulkCreateAssetsSchema>;

/** Update an asset — any subset. Setting `value` appends a valuation row. */
export const updateAssetSchema = z.object({
  type: assetTypeKey.optional(),
  label: z.string().min(1).max(160).optional(),
  institution: z.string().max(160).nullish(),
  currency: currencyCode.optional(),
  value: money.optional(),
  units: units.nullish(),
  identifier: z.string().max(120).nullish(),
  maturityDate: z.string().date().nullish(),
  status: z.enum(assetStatuses).optional(),
  notes: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
  /** Replace the per-type detail fields; `null` clears them. */
  details: assetDetails.nullish(),
});
export type UpdateAssetDto = z.infer<typeof updateAssetSchema>;

/** Append a valuation snapshot (history / time-machine). */
export const recordValuationSchema = z.object({
  value: money,
  currency: currencyCode,
  /** As-of date of the value (statement date). Defaults to today server-side. */
  asOf: z.string().date().optional(),
  source: z.enum(['manual', 'extracted', 'aa']).default('manual'),
});
export type RecordValuationDto = z.infer<typeof recordValuationSchema>;

/** Server-side pagination/search/sort/filter for the asset list. */
export const listAssetsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: assetTypeKey.optional(),
  status: z.enum(assetStatuses).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['label', 'type', 'value', 'updated', 'maturity'])
    .default('updated'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListAssetsQueryDto = z.infer<typeof listAssetsQuerySchema>;

/** Vault-wide search: matches across asset fields, attached-document text and
 *  AI analysis summaries within a single profile (≠ the global drafting search). */
export const vaultSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type VaultSearchQueryDto = z.infer<typeof vaultSearchQuerySchema>;

// ── Module config (config-as-data, docs/13 §0.3) ──────────────────────────

/** How an asset type's value is maintained (auto-valuation, §11.2). */
export const assetValuationModes = [
  'manual',
  'spot_gold', // quantity (grams) × daily spot
  'circle_rate', // property: area × locality rate (estimate)
] as const;

export const assetCategories = ['financial', 'physical', 'other'] as const;

/** One configurable detail field for an asset type (mirrors AssetFieldDef). */
export const assetFieldDefSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/),
  label: z.string().min(1).max(80),
  type: z.enum(['text', 'number', 'date', 'select', 'currency']).default('text'),
  options: z
    .array(z.object({ value: z.string().max(80), label: z.string().max(80) }))
    .optional(),
  placeholder: z.string().max(120).optional(),
  suffix: z.string().max(16).optional(),
});
export type AssetFieldDefDto = z.infer<typeof assetFieldDefSchema>;

export const estateAssetTypeSchema = z.object({
  key: assetTypeKey,
  label: z.string().min(1).max(80),
  category: z.enum(assetCategories).default('financial'),
  valuation: z.enum(assetValuationModes).default('manual'),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  /** This type holds a quantity (MF/ETF units, demat shares, grams of gold) —
   *  drives whether the UI shows a "units" field and the extractor asks for it. */
  tracksUnits: z.boolean().default(false),
  /** Analytics asset-class (equity/debt/cash/real_estate/gold/…). When unset the
   *  code default map (`DEFAULT_ASSET_CLASS`) is used. */
  assetClass: z.enum(ASSET_CLASSES).optional(),
  /** Liquidity bucket for the liquidity analysis. Code default when unset. */
  liquidity: z.enum(['high', 'medium', 'low']).optional(),
  /** Relabel the built-in maturity-date field for this type (e.g. "Valid till"). */
  dateLabel: z.string().max(40).optional(),
  /** Per-type detail fields. When unset, the code registry (ASSET_TYPE_FIELDS)
   *  supplies them — so orgs can override/extend without losing the rich defaults. */
  fields: z.array(assetFieldDefSchema).max(40).optional(),
});
export type EstateAssetTypeDto = z.infer<typeof estateAssetTypeSchema>;

/** Wealth-analysis knobs (config-as-data) — drive the deterministic analytics. */
export const estateAnalysisConfigSchema = z.object({
  /** Window (days) for the "maturing soon" / liquidity-need check. */
  maturingWindowDays: z.number().int().min(7).max(730).default(90),
  /** A single type above this % of net worth is flagged as concentration risk. */
  concentrationWarnPct: z.number().int().min(10).max(100).default(40),
  concentrationHighPct: z.number().int().min(10).max(100).default(60),
  /** Target nominee coverage (% of value) below which succession is flagged. */
  minNomineeCoveragePct: z.number().int().min(0).max(100).default(100),
  /** Months of expenses an emergency (liquid) buffer should ideally cover —
   *  used only when a monthly-expense figure is supplied. */
  emergencyFundMonths: z.number().int().min(0).max(24).default(6),
  /** Target allocation by asset class (%). Keyed by an asset-class id (see
   *  ASSET_CLASSES). Empty = no opinion on the “ideal” mix (purely descriptive). */
  idealAllocation: z
    .record(z.string(), z.number().min(0).max(100))
    .default({}),
});
export type EstateAnalysisConfigDto = z.infer<typeof estateAnalysisConfigSchema>;

export const estateVaultConfigSchema = z.object({
  enabled: z.boolean().default(true),
  assetTypes: z.array(estateAssetTypeSchema).default([]),
  baseCurrency: currencyCode,
  /** Liveness/dead-man-switch knobs (used from M5; stored from M1). */
  livenessCadenceDays: z.number().int().min(1).max(365).default(90),
  missedPingsBeforeEscalation: z.number().int().min(1).max(10).default(3),
  coolingOffDays: z.number().int().min(0).max(90).default(14),
  maxNomineesPerAsset: z.number().int().min(1).max(4).default(4),
  /** Freshness/dormancy thresholds (days) for gap nudges (§10.2). */
  freshnessThresholdDays: z.number().int().min(7).max(1095).default(180),
  dormancyThresholdDays: z.number().int().min(30).max(1825).default(365),
  /** Wealth-analysis knobs (concentration thresholds, maturity window, ideal mix). */
  analysis: estateAnalysisConfigSchema.default({
    maturingWindowDays: 90,
    concentrationWarnPct: 40,
    concentrationHighPct: 60,
    minNomineeCoveragePct: 100,
    emergencyFundMonths: 6,
    idealAllocation: {},
  }),
  toggles: z
    .object({
      netWorthDashboard: z.boolean().default(true),
      gapNudges: z.boolean().default(true),
      claimsConcierge: z.boolean().default(false),
      b2b2c: z.boolean().default(false),
    })
    .default({
      netWorthDashboard: true,
      gapNudges: true,
      claimsConcierge: false,
      b2b2c: false,
    }),
  /** Manual tracking entry (no workflow): the how-to-claim text + nominee≠heir
   *  copy need an Indian lawyer's review before relying on them (docs/13 D.2.6).
   *  Admins flip the status + jot a note here so it's a visible follow-up. */
  legalReview: z
    .object({
      status: z.enum(['pending', 'in_review', 'approved']).default('pending'),
      note: z.string().max(2000).default(''),
      reviewedBy: z.string().max(160).default(''),
      reviewedAt: z.string().max(40).default(''),
    })
    .default({ status: 'pending', note: '', reviewedBy: '', reviewedAt: '' }),
});
export type EstateVaultConfigDto = z.infer<typeof estateVaultConfigSchema>;

// ── Managed person-vaults (profiles, docs/13) ──────────────────────────────

/** Create a managed profile — link a Vault person, or mint one from these. */
export const createEstateProfileSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  vaultEntityId: z.string().max(64).optional(),
  name: z.string().max(160).optional(),
  dob: z.string().date().optional(),
  aadhaar: z.string().max(20).optional(),
  pan: z.string().max(15).optional(),
  phone: z.string().max(40).optional(),
  address: z.string().max(500).optional(),
});
export type CreateEstateProfileDto = z.infer<typeof createEstateProfileSchema>;

/** Update a profile's settings: label and the amount-masking privacy default. */
export const updateEstateProfileSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  maskAmounts: z.boolean().optional(),
});
export type UpdateEstateProfileDto = z.infer<typeof updateEstateProfileSchema>;

/** Share a profile with another account (e.g. a 3rd-party wealth manager). */
export const shareEstateProfileSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['manager', 'viewer']).default('manager'),
});
export type ShareEstateProfileDto = z.infer<typeof shareEstateProfileSchema>;

/** Admin update of the module config (partial merge over current). */
export const updateEstateVaultConfigSchema = estateVaultConfigSchema.partial();
export type UpdateEstateVaultConfigDto = z.infer<
  typeof updateEstateVaultConfigSchema
>;

// ── M5: nominees, nominations, release plan (docs/13 §1.2, §9) ─────────────

/** Common relationships (fallback when the `relationship` lookup is unseeded). */
export const RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Grandson',
  'Granddaughter',
  'Nephew',
  'Niece',
  'Friend',
  'Other',
] as const;

export const createNomineeSchema = z.object({
  name: z.string().min(1, "Enter the nominee's name").max(160),
  email: z.string().email('Enter a valid email'),
  relationship: z.string().max(80).optional(),
  /** ISO date (yyyy-mm-dd). */
  dob: z.string().date().optional(),
  /** The following identifiers are stored encrypted, shown masked. */
  phone: z.string().max(40).optional(),
  aadhaar: z.string().max(20).optional(),
  pan: z.string().max(15).optional(),
  address: z.string().max(500).optional(),
  /** Optional link to a Vault person entity holding full KYC + documents. */
  vaultEntityId: z.string().max(64).optional(),
});
export type CreateNomineeDto = z.infer<typeof createNomineeSchema>;

export const updateNomineeSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  email: z.string().email().optional(),
  relationship: z.string().max(80).nullish(),
  dob: z.string().date().nullish(),
  phone: z.string().max(40).nullish(),
  aadhaar: z.string().max(20).nullish(),
  pan: z.string().max(15).nullish(),
  address: z.string().max(500).nullish(),
  vaultEntityId: z.string().max(64).nullish(),
});
export type UpdateNomineeDto = z.infer<typeof updateNomineeSchema>;

/** One nomination row for an asset (up to 4 per asset). */
export const nominationInputSchema = z.object({
  nomineeId: z.string().min(1),
  priority: z.number().int().min(1).max(4).default(1),
  sharePercent: z.number().int().min(1).max(100).nullish(),
});

/** Replace-set of an asset's nominees, in priority order. */
export const setNominationsSchema = z.object({
  nominations: z.array(nominationInputSchema).max(4).default([]),
});
export type SetNominationsDto = z.infer<typeof setNominationsSchema>;

/** Owner edits the release plan for one nominee. */
export const updateReleasePlanSchema = z.object({
  cadenceDays: z.number().int().min(1).max(365).optional(),
  scope: z.enum(['all', 'nominated']).optional(),
});
export type UpdateReleasePlanDto = z.infer<typeof updateReleasePlanSchema>;
