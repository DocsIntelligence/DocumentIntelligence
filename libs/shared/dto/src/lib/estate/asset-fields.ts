/**
 * Static per-asset-type field registry — shared by the app (form rendering +
 * display) and the API (statement-extraction guidance + sanitisation). Each
 * asset kind declares the structured detail fields that matter for it; values
 * live in `Asset.details` (a flat JSON map).
 *
 * Code-defined on purpose (not a dynamic schema-authoring UI): proper per-kind
 * detail without the weight of the document-type schema/pipeline machinery.
 * Labels carry English defaults; the app translates them at render.
 */

export type AssetFieldType = 'text' | 'number' | 'date' | 'select' | 'currency';

export interface AssetFieldDef {
  key: string;
  label: string;
  type: AssetFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** Inline suffix shown after the input (e.g. '%', 'g', 'sq.ft'). */
  suffix?: string;
}

export interface AssetTypeMeta {
  /** Relabel the built-in maturity-date field for this kind (e.g. "Valid till"). */
  dateLabel?: string;
  fields: AssetFieldDef[];
}

const SHARES: AssetTypeMeta = {
  fields: [
    {
      key: 'exchange',
      label: 'Exchange',
      type: 'select',
      options: [
        { value: 'NSE', label: 'NSE' },
        { value: 'BSE', label: 'BSE' },
        { value: 'other', label: 'Other' },
      ],
    },
    { key: 'ticker', label: 'Ticker / symbol', type: 'text', placeholder: 'e.g. INFY, TCS' },
    { key: 'isin', label: 'ISIN', type: 'text', placeholder: 'e.g. INE009A01021' },
    { key: 'avgBuyPrice', label: 'Avg. buy price', type: 'currency', placeholder: 'per share' },
    { key: 'sector', label: 'Sector', type: 'text', placeholder: 'e.g. IT, Banking' },
    { key: 'dematAccount', label: 'Demat account', type: 'text', placeholder: 'NSDL/CDSL DP ID' },
  ],
};

const FD_LIKE = (dateLabel: string): AssetTypeMeta => ({
  dateLabel,
  fields: [
    { key: 'principal', label: 'Principal deposited', type: 'currency', placeholder: 'amount invested' },
    { key: 'interestRate', label: 'Interest rate', type: 'number', suffix: '%', placeholder: 'e.g. 7.1' },
    {
      key: 'payoutFrequency',
      label: 'Interest payout',
      type: 'select',
      options: [
        { value: 'cumulative', label: 'Cumulative (on maturity)' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'yearly', label: 'Yearly' },
      ],
    },
    { key: 'startDate', label: 'Start date', type: 'date' },
    { key: 'tenureMonths', label: 'Tenure (months)', type: 'number', placeholder: 'e.g. 60' },
    { key: 'autoRenew', label: 'Auto-renew on maturity', type: 'select', options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
    ] },
    { key: 'branch', label: 'Branch', type: 'text', placeholder: 'branch name' },
  ],
});

export const ASSET_TYPE_FIELDS: Record<string, AssetTypeMeta> = {
  bank: {
    fields: [
      {
        key: 'accountKind',
        label: 'Account type',
        type: 'select',
        options: [
          { value: 'savings', label: 'Savings' },
          { value: 'current', label: 'Current' },
          { value: 'salary', label: 'Salary' },
          { value: 'nri', label: 'NRI (NRE/NRO)' },
        ],
      },
      { key: 'ifsc', label: 'IFSC', type: 'text', placeholder: 'e.g. HDFC0000123' },
      { key: 'branch', label: 'Branch', type: 'text', placeholder: 'branch name / city' },
      {
        key: 'jointHolding',
        label: 'Holding',
        type: 'select',
        options: [
          { value: 'single', label: 'Single' },
          { value: 'either_or_survivor', label: 'Either or survivor' },
          { value: 'joint', label: 'Joint' },
        ],
      },
    ],
  },

  fixed_deposit: FD_LIKE('Maturity date'),
  bond: {
    dateLabel: 'Maturity date',
    fields: [
      { key: 'issuer', label: 'Issuer', type: 'text', placeholder: 'e.g. NHAI, REC, govt.' },
      { key: 'isin', label: 'ISIN', type: 'text', placeholder: 'e.g. INE...' },
      { key: 'couponRate', label: 'Coupon rate', type: 'number', suffix: '%', placeholder: 'e.g. 7.5' },
      { key: 'faceValue', label: 'Face value', type: 'currency', placeholder: 'per bond' },
      { key: 'taxFree', label: 'Tax-free', type: 'select', options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ] },
    ],
  },
  ppf: {
    dateLabel: 'Maturity date',
    fields: [
      { key: 'accountNo', label: 'Account number', type: 'text' },
      { key: 'branch', label: 'Branch / post office', type: 'text' },
      { key: 'openedDate', label: 'Opened on', type: 'date' },
      { key: 'annualContribution', label: 'Annual contribution', type: 'currency', placeholder: 'e.g. 150000' },
    ],
  },

  mutual_fund: {
    fields: [
      { key: 'fundHouse', label: 'Fund house (AMC)', type: 'text', placeholder: 'e.g. HDFC AMC, SBI MF' },
      { key: 'scheme', label: 'Scheme name', type: 'text', placeholder: 'e.g. HDFC Flexi Cap - Direct Growth' },
      { key: 'folioNo', label: 'Folio number', type: 'text', placeholder: 'AMC folio' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'equity', label: 'Equity' },
          { value: 'debt', label: 'Debt' },
          { value: 'hybrid', label: 'Hybrid' },
          { value: 'liquid', label: 'Liquid / money-market' },
          { value: 'elss', label: 'ELSS (tax-saver)' },
          { value: 'index', label: 'Index / ETF' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        key: 'plan',
        label: 'Plan',
        type: 'select',
        options: [
          { value: 'direct', label: 'Direct' },
          { value: 'regular', label: 'Regular' },
        ],
      },
      {
        key: 'mode',
        label: 'Investment mode',
        type: 'select',
        options: [
          { value: 'sip', label: 'SIP' },
          { value: 'lumpsum', label: 'Lumpsum' },
          { value: 'both', label: 'SIP + lumpsum' },
        ],
      },
      { key: 'sipAmount', label: 'SIP amount (monthly)', type: 'currency', placeholder: 'if any' },
      { key: 'investedAmount', label: 'Total invested (cost)', type: 'currency', placeholder: 'for gain calc' },
      { key: 'nav', label: 'Latest NAV', type: 'number', placeholder: 'per unit' },
    ],
  },

  stocks: SHARES,
  shares: SHARES,
  equity: SHARES,

  insurance: {
    dateLabel: 'Valid till',
    fields: [
      {
        key: 'insuranceKind',
        label: 'Policy type',
        type: 'select',
        options: [
          { value: 'life', label: 'Life' },
          { value: 'term', label: 'Term' },
          { value: 'health', label: 'Health' },
          { value: 'vehicle', label: 'Vehicle' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'insurer', label: 'Insurer', type: 'text', placeholder: 'e.g. LIC, HDFC Life' },
      { key: 'sumAssured', label: 'Sum assured', type: 'currency', placeholder: 'cover amount' },
      { key: 'premium', label: 'Premium', type: 'currency', placeholder: 'per payment' },
      {
        key: 'premiumFrequency',
        label: 'Premium frequency',
        type: 'select',
        options: [
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'half_yearly', label: 'Half-yearly' },
          { value: 'yearly', label: 'Yearly' },
          { value: 'single', label: 'Single premium' },
        ],
      },
      { key: 'policyTerm', label: 'Policy term', type: 'text', placeholder: 'e.g. 20 years' },
      { key: 'maturityValue', label: 'Maturity / fund value', type: 'currency', placeholder: 'if applicable' },
      { key: 'nomineeOnPolicy', label: 'Nominee on policy', type: 'text', placeholder: 'as registered with insurer' },
    ],
  },

  property: {
    dateLabel: 'Lease / agreement valid till',
    fields: [
      {
        key: 'propertyKind',
        label: 'Property type',
        type: 'select',
        options: [
          { value: 'residential_flat', label: 'Residential — flat / apartment' },
          { value: 'residential_house', label: 'Residential — independent house' },
          { value: 'plot', label: 'Plot / land' },
          { value: 'agricultural', label: 'Agricultural land' },
          { value: 'commercial', label: 'Commercial' },
          { value: 'industrial', label: 'Industrial' },
          { value: 'other', label: 'Other' },
        ],
      },
      {
        key: 'ownership',
        label: 'Ownership',
        type: 'select',
        options: [
          { value: 'sole', label: 'Sole owner' },
          { value: 'joint', label: 'Joint' },
          { value: 'ancestral', label: 'Ancestral / HUF' },
          { value: 'inherited', label: 'Inherited' },
        ],
      },
      { key: 'ownershipPct', label: 'Your ownership share', type: 'number', suffix: '%', placeholder: 'e.g. 50' },
      { key: 'coOwners', label: 'Co-owners', type: 'text', placeholder: 'names, if joint' },
      { key: 'addressLine', label: 'Address', type: 'text', placeholder: 'flat/plot, building, street' },
      { key: 'locality', label: 'Locality / area', type: 'text', placeholder: 'e.g. Koramangala' },
      { key: 'city', label: 'City', type: 'text', placeholder: 'e.g. Bengaluru' },
      { key: 'state', label: 'State', type: 'text', placeholder: 'e.g. Karnataka' },
      { key: 'pincode', label: 'PIN code', type: 'text', placeholder: '6 digits' },
      { key: 'area', label: 'Area', type: 'number', placeholder: 'built-up / plot area' },
      {
        key: 'areaUnit',
        label: 'Area unit',
        type: 'select',
        options: [
          { value: 'sqft', label: 'sq.ft' },
          { value: 'sqyd', label: 'sq.yd' },
          { value: 'sqm', label: 'sq.m' },
          { value: 'acre', label: 'acre' },
          { value: 'guntha', label: 'guntha' },
          { value: 'cent', label: 'cent' },
        ],
      },
      { key: 'purchaseDate', label: 'Date of purchase', type: 'date' },
      { key: 'purchasePrice', label: 'Purchase price', type: 'currency', placeholder: 'cost — for capital-gains' },
      {
        key: 'valuationBasis',
        label: 'Current value basis',
        type: 'select',
        options: [
          { value: 'market', label: 'Market estimate' },
          { value: 'circle_rate', label: 'Circle / guidance rate' },
          { value: 'registered', label: 'Registered / agreement value' },
          { value: 'broker', label: 'Broker valuation' },
        ],
      },
      { key: 'loanOutstanding', label: 'Home-loan outstanding', type: 'currency', placeholder: 'if mortgaged' },
      { key: 'loanLender', label: 'Loan lender', type: 'text', placeholder: 'bank/NBFC' },
      {
        key: 'occupancy',
        label: 'Occupancy',
        type: 'select',
        options: [
          { value: 'self', label: 'Self-occupied' },
          { value: 'rented', label: 'Let out / rented' },
          { value: 'vacant', label: 'Vacant' },
        ],
      },
      { key: 'rentMonthly', label: 'Monthly rent received', type: 'currency', placeholder: 'if rented' },
      { key: 'tenantName', label: 'Tenant', type: 'text', placeholder: 'if rented' },
      { key: 'surveyNo', label: 'Survey / khata / RERA no.', type: 'text', placeholder: 'land record id' },
      { key: 'registrationNo', label: 'Registration / sale-deed no.', type: 'text', placeholder: 'sub-registrar doc no.' },
    ],
  },

  gold: {
    fields: [
      {
        key: 'form',
        label: 'Form',
        type: 'select',
        options: [
          { value: 'jewellery', label: 'Jewellery' },
          { value: 'coin', label: 'Coin' },
          { value: 'bar', label: 'Bar' },
          { value: 'digital', label: 'Digital / SGB' },
        ],
      },
      { key: 'grams', label: 'Weight', type: 'number', suffix: 'g', placeholder: 'net gold weight' },
      {
        key: 'purity',
        label: 'Purity',
        type: 'select',
        options: [
          { value: '24K', label: '24K (999)' },
          { value: '22K', label: '22K (916)' },
          { value: '18K', label: '18K (750)' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'storedAt', label: 'Stored at', type: 'text', placeholder: 'e.g. bank locker, home safe' },
      { key: 'hallmark', label: 'Hallmark / certificate', type: 'text', placeholder: 'BIS / SGB cert no.' },
    ],
  },

  crypto: {
    fields: [
      { key: 'coin', label: 'Coin / token', type: 'text', placeholder: 'e.g. BTC, ETH' },
      { key: 'platform', label: 'Exchange / wallet', type: 'text', placeholder: 'e.g. CoinDCX, Ledger' },
      {
        key: 'custody',
        label: 'Custody',
        type: 'select',
        options: [
          { value: 'exchange', label: 'On exchange' },
          { value: 'self', label: 'Self-custody (wallet)' },
        ],
      },
      { key: 'quantity', label: 'Quantity', type: 'number', placeholder: 'coins/tokens held' },
      { key: 'avgBuyPrice', label: 'Avg. buy price', type: 'currency', placeholder: 'per coin' },
    ],
  },

  epf: {
    fields: [
      { key: 'uan', label: 'UAN', type: 'text', placeholder: '12-digit UAN' },
      { key: 'memberId', label: 'Member ID', type: 'text' },
      { key: 'employer', label: 'Current employer', type: 'text' },
      { key: 'employeeShare', label: 'Employee share', type: 'currency', placeholder: 'if split shown' },
      { key: 'employerShare', label: 'Employer share', type: 'currency', placeholder: 'if split shown' },
    ],
  },

  nps: {
    fields: [
      { key: 'pran', label: 'PRAN', type: 'text', placeholder: '12-digit PRAN' },
      {
        key: 'tier',
        label: 'Tier',
        type: 'select',
        options: [
          { value: 'tier1', label: 'Tier I' },
          { value: 'tier2', label: 'Tier II' },
        ],
      },
      {
        key: 'scheme',
        label: 'Scheme preference',
        type: 'select',
        options: [
          { value: 'auto', label: 'Auto choice' },
          { value: 'active', label: 'Active choice' },
        ],
      },
      { key: 'fundManager', label: 'Pension fund manager', type: 'text', placeholder: 'e.g. HDFC PF' },
    ],
  },

  vehicle: {
    fields: [
      {
        key: 'vehicleKind',
        label: 'Vehicle type',
        type: 'select',
        options: [
          { value: 'car', label: 'Car' },
          { value: 'two_wheeler', label: 'Two-wheeler' },
          { value: 'commercial', label: 'Commercial' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'regNo', label: 'Registration no.', type: 'text', placeholder: 'e.g. KA01AB1234' },
      { key: 'make', label: 'Make', type: 'text', placeholder: 'e.g. Maruti' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'e.g. Baleno' },
      { key: 'year', label: 'Year of manufacture', type: 'number', placeholder: 'e.g. 2021' },
      { key: 'purchasePrice', label: 'Purchase price', type: 'currency', placeholder: 'on-road cost' },
      { key: 'loanOutstanding', label: 'Loan outstanding', type: 'currency', placeholder: 'if financed' },
    ],
  },
};

/**
 * Default asset-class + liquidity maps (code fallback — overridable per type via
 * the EstateVaultConfig `assetClass`/`liquidity` fields). Used by the wealth
 * analytics to compute the asset-class mix, liquidity buckets, and allocation
 * gaps. Keep in sync conceptually with the asset-type catalog keys.
 */
export const ASSET_CLASSES = [
  'equity',
  'debt',
  'cash',
  'real_estate',
  'gold',
  'retirement',
  'insurance',
  'alternative',
  'other',
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const DEFAULT_ASSET_CLASS: Record<string, AssetClass> = {
  bank: 'cash',
  fixed_deposit: 'debt',
  bond: 'debt',
  ppf: 'debt',
  mutual_fund: 'equity', // refined by details.category at analysis time
  stocks: 'equity',
  shares: 'equity',
  equity: 'equity',
  insurance: 'insurance',
  epf: 'retirement',
  nps: 'retirement',
  property: 'real_estate',
  gold: 'gold',
  crypto: 'alternative',
  vehicle: 'other',
  other: 'other',
};

export const DEFAULT_LIQUIDITY: Record<string, 'high' | 'medium' | 'low'> = {
  bank: 'high',
  mutual_fund: 'high',
  stocks: 'high',
  shares: 'high',
  equity: 'high',
  crypto: 'high',
  fixed_deposit: 'medium',
  bond: 'medium',
  gold: 'medium',
  nps: 'low',
  epf: 'low',
  ppf: 'low',
  insurance: 'low',
  property: 'low',
  vehicle: 'low',
  other: 'medium',
};

export function assetClassForType(type: string): AssetClass {
  return DEFAULT_ASSET_CLASS[type] ?? 'other';
}

export function liquidityForType(type: string): 'high' | 'medium' | 'low' {
  return DEFAULT_LIQUIDITY[type] ?? 'medium';
}

/** Human label for an asset class (for charts/narrative). */
export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  equity: 'Equity',
  debt: 'Debt / fixed income',
  cash: 'Cash & equivalents',
  real_estate: 'Real estate',
  gold: 'Gold',
  retirement: 'Retirement (EPF/NPS)',
  insurance: 'Insurance',
  alternative: 'Alternatives',
  other: 'Other',
};

export function metaForType(type: string): AssetTypeMeta {
  return ASSET_TYPE_FIELDS[type] ?? { fields: [] };
}

/**
 * Guidance appended to the statement-extraction prompt so the model knows which
 * `details` keys to populate per asset type (and the allowed values for the
 * `select` fields). Built from the registry, so it never drifts.
 */
export function assetDetailGuidance(typeKeys: string[]): string {
  const lines = typeKeys
    .map((k) => {
      const meta = ASSET_TYPE_FIELDS[k];
      if (!meta || meta.fields.length === 0) return null;
      const parts = meta.fields.map((f) =>
        f.type === 'select'
          ? `${f.key}[${(f.options ?? []).map((o) => o.value).join('|')}]`
          : f.key,
      );
      return `${k}: ${parts.join(', ')}`;
    })
    .filter((v): v is string => !!v);
  return lines.length
    ? `Type-specific fields — put values in a \`details\` object keyed exactly by these keys (omit any you cannot read; use the allowed value for [bracketed] options):\n- ${lines.join('\n- ')}`
    : '';
}

/**
 * Filter + coerce a model-emitted (or otherwise untrusted) detail map down to
 * the fields the given asset type actually declares — numbers parsed, selects
 * matched by value or label, empties dropped. Returns undefined when nothing
 * usable remains.
 */
export function sanitizeDetails(
  type: string,
  raw: unknown,
): Record<string, string | number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const src = raw as Record<string, unknown>;
  const meta = metaForType(type);
  const out: Record<string, string | number> = {};
  for (const f of meta.fields) {
    const v = src[f.key];
    if (v === undefined || v === null || v === '') continue;
    if (f.type === 'number' || f.type === 'currency') {
      const n =
        typeof v === 'number'
          ? v
          : Number(String(v).replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(n)) out[f.key] = n;
    } else if (f.type === 'select') {
      const sv = String(v).trim();
      const byValue = f.options?.find((o) => o.value === sv);
      const byLabel = f.options?.find(
        (o) => o.label.toLowerCase() === sv.toLowerCase(),
      );
      if (byValue) out[f.key] = byValue.value;
      else if (byLabel) out[f.key] = byLabel.value;
    } else {
      out[f.key] = String(v).trim();
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
