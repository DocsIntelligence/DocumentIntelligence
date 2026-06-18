import type { EstateVaultConfigDto } from '@org/dto';

/** Env flag — the module-level kill switch (docs/13 §0.1). Default ON. */
export const ESTATE_VAULT_ENABLED = 'ESTATE_VAULT_ENABLED';

/**
 * Code-default module config (docs/13 §0.3). Seeded into EstateVaultConfig as
 * the system row (ownerOrgId=null) on first use; orgs override via the admin
 * API. India-first asset-type catalog with auto-valuation hints (§11.2):
 *   - gold → `spot_gold` (store grams, value at daily spot)
 *   - property → `circle_rate` (store area + locality, estimate)
 */
export const DEFAULT_ESTATE_CONFIG: EstateVaultConfigDto = {
  enabled: true,
  baseCurrency: 'INR',
  livenessCadenceDays: 90,
  missedPingsBeforeEscalation: 3,
  coolingOffDays: 14,
  maxNomineesPerAsset: 4,
  freshnessThresholdDays: 180,
  dormancyThresholdDays: 365,
  toggles: {
    netWorthDashboard: true,
    gapNudges: true,
    claimsConcierge: false,
    b2b2c: false,
  },
  legalReview: { status: 'pending', note: '', reviewedBy: '', reviewedAt: '' },
  assetTypes: [
    { key: 'bank', label: 'Bank account', category: 'financial', valuation: 'manual', sortOrder: 0, isActive: true, tracksUnits: false },
    { key: 'fixed_deposit', label: 'Fixed deposit', category: 'financial', valuation: 'manual', sortOrder: 1, isActive: true, tracksUnits: false },
    { key: 'mutual_fund', label: 'Mutual fund', category: 'financial', valuation: 'manual', sortOrder: 2, isActive: true, tracksUnits: true },
    { key: 'stocks', label: 'Stocks / demat', category: 'financial', valuation: 'manual', sortOrder: 3, isActive: true, tracksUnits: true },
    { key: 'insurance', label: 'Insurance policy', category: 'financial', valuation: 'manual', sortOrder: 4, isActive: true, tracksUnits: false },
    { key: 'epf', label: 'EPF', category: 'financial', valuation: 'manual', sortOrder: 5, isActive: true, tracksUnits: false },
    { key: 'nps', label: 'NPS', category: 'financial', valuation: 'manual', sortOrder: 6, isActive: true, tracksUnits: true },
    { key: 'ppf', label: 'PPF', category: 'financial', valuation: 'manual', sortOrder: 7, isActive: true, tracksUnits: false },
    { key: 'bond', label: 'Bonds', category: 'financial', valuation: 'manual', sortOrder: 8, isActive: true, tracksUnits: true },
    { key: 'property', label: 'Real estate', category: 'physical', valuation: 'circle_rate', sortOrder: 9, isActive: true, tracksUnits: false },
    { key: 'gold', label: 'Gold', category: 'physical', valuation: 'spot_gold', sortOrder: 10, isActive: true, tracksUnits: true },
    { key: 'vehicle', label: 'Vehicle', category: 'physical', valuation: 'manual', sortOrder: 11, isActive: true, tracksUnits: false },
    { key: 'crypto', label: 'Crypto', category: 'other', valuation: 'manual', sortOrder: 12, isActive: true, tracksUnits: true },
    { key: 'other', label: 'Other', category: 'other', valuation: 'manual', sortOrder: 13, isActive: true, tracksUnits: false },
  ],
};

/**
 * Default "how to claim this" instructions per asset type (docs/13 §10.3) — the
 * step that turns "find everything" into a checklist for the nominee. India-
 * specific; legal/ops review required before relying on these (docs/13 D.2.6).
 * Kept as code-data for v1; can move into EstateVaultConfig later.
 */
export const CLAIM_INSTRUCTIONS: Record<string, string> = {
  bank: 'Submit the death certificate, your KYC, and the bank’s nominee claim form at the branch. Without a registered nominee, a succession certificate may be required.',
  fixed_deposit:
    'Approach the bank with the FD receipt/number, death certificate, and KYC. Premature-closure rules vary; the nominee receives proceeds as a trustee.',
  mutual_fund:
    'Request transmission from the AMC/RTA (CAMS or KFintech) with the folio number, death certificate, KYC, and the transmission form.',
  stocks:
    'Contact the depository participant (NSDL/CDSL) for transmission of demat holdings with the death certificate, client-master, and KYC.',
  insurance:
    'File a death claim with the insurer using the policy number, death certificate, and claimant KYC. Escalate via IRDAI Bima Bharosa if delayed.',
  epf: 'Submit EPF Forms 20/10D via the employer or the EPFO member portal with the UAN, death certificate, and nominee details.',
  nps: 'Apply to the PoP / NPS Trust for withdrawal with the PRAN, death certificate, and KYC.',
  ppf: 'Approach the bank/post office holding the PPF with the death certificate and nominee or legal-heir proof.',
  bond: 'Contact the issuer/RTA for transmission with the certificate/holding details, death certificate, and KYC.',
  property:
    'Establish title via the will or a succession certificate, then mutate records at the sub-registrar / municipal office.',
  gold: 'Physical gold passes under the will/succession. Bank-locker contents follow the locker-nominee process with the death certificate.',
  crypto:
    'Access requires the wallet keys or exchange-account recovery — ensure keys/seed phrases are documented securely. Exchanges have a nominee/transmission process.',
  vehicle:
    'Transfer ownership at the RTO with the death certificate, RC, and succession/will proof.',
  other:
    'Provide the death certificate, your ID/KYC, and proof of relationship to the holding institution. A will or succession certificate establishes ownership.',
};

export function claimInstructionFor(type: string): string {
  return CLAIM_INSTRUCTIONS[type] ?? CLAIM_INSTRUCTIONS['other'];
}

/**
 * Per-asset-type extraction guidance (docs/13 §11.3) — folded into the AI
 * prompt so the model extracts the RIGHT number per instrument. The recurring
 * accuracy bug is reading *invested/cost* instead of *current market value*,
 * and missing the units/quantity. Keep each line specific + imperative.
 */
export const EXTRACTION_GUIDANCE: Record<string, string> = {
  mutual_fund:
    'Mutual fund: `value` = CURRENT market value (units × latest NAV), NOT the invested/cost amount. `units` = units held (fractional, e.g. 1234.567). `identifier` = folio number. Treat every scheme/folio as a separate holding.',
  stocks:
    'Stocks/demat: `value` = CURRENT market value (quantity × price). `units` = number of shares. `identifier` = ISIN or demat account. One holding per scrip.',
  insurance:
    'Insurance: `value` = fund value (ULIP) or sum assured. `identifier` = policy number. Capture `maturityDate`. No units.',
  bank: 'Bank account: `value` = available/closing BALANCE. `identifier` = account number. No units.',
  fixed_deposit:
    'Fixed deposit: `value` = current or maturity value. `identifier` = FD/receipt number. Capture `maturityDate`. No units.',
  epf: 'EPF: `value` = total corpus/current balance. `identifier` = UAN/member ID. No units.',
  nps: 'NPS: `value` = current corpus. `units` = total units across schemes if shown. `identifier` = PRAN.',
  ppf: 'PPF: `value` = current balance. `identifier` = account number. Capture `maturityDate`. No units.',
  bond: 'Bonds: `value` = market/face value held. `units` = quantity/number of bonds. `identifier` = ISIN. Capture `maturityDate`.',
  gold: 'Gold: `units` = grams held. `value` = current value of that quantity.',
  crypto: 'Crypto: `units` = quantity of coins/tokens. `value` = current INR value. `identifier` = wallet/exchange account.',
  property: 'Real estate: `value` = current/estimated value. `identifier` = survey/khata/registration number. No units.',
  vehicle: 'Vehicle: `value` = current resale value. `identifier` = registration number. No units.',
};

/** Build a compact guidance block for the asset types active in this org. */
export function extractionGuidanceBlock(typeKeys: string[]): string {
  const lines = typeKeys
    .map((k) => EXTRACTION_GUIDANCE[k])
    .filter((v): v is string => !!v);
  return lines.length ? `Per-type rules:\n- ${lines.join('\n- ')}` : '';
}
