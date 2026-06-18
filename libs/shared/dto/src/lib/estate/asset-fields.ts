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
    { key: 'ticker', label: 'Ticker / symbol', type: 'text', placeholder: 'e.g. INFY' },
    { key: 'avgBuyPrice', label: 'Avg. buy price (₹)', type: 'number' },
    { key: 'dematAccount', label: 'Demat account', type: 'text' },
  ],
};

const FD_LIKE = (dateLabel: string): AssetTypeMeta => ({
  dateLabel,
  fields: [
    { key: 'interestRate', label: 'Interest rate', type: 'number', suffix: '%' },
    {
      key: 'payoutFrequency',
      label: 'Payout',
      type: 'select',
      options: [
        { value: 'cumulative', label: 'Cumulative' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'yearly', label: 'Yearly' },
      ],
    },
    { key: 'tenureMonths', label: 'Tenure (months)', type: 'number' },
    { key: 'branch', label: 'Branch', type: 'text' },
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
          { value: 'nri', label: 'NRI' },
        ],
      },
      { key: 'ifsc', label: 'IFSC', type: 'text', placeholder: 'e.g. HDFC0000123' },
      { key: 'branch', label: 'Branch', type: 'text' },
    ],
  },

  fixed_deposit: FD_LIKE('Maturity date'),
  bond: {
    dateLabel: 'Maturity date',
    fields: [
      { key: 'issuer', label: 'Issuer', type: 'text' },
      { key: 'couponRate', label: 'Coupon rate', type: 'number', suffix: '%' },
      { key: 'faceValue', label: 'Face value (₹)', type: 'currency' },
    ],
  },
  ppf: {
    dateLabel: 'Maturity date',
    fields: [
      { key: 'accountNo', label: 'Account number', type: 'text' },
      { key: 'branch', label: 'Branch / post office', type: 'text' },
    ],
  },

  mutual_fund: {
    fields: [
      { key: 'fundHouse', label: 'Fund house (AMC)', type: 'text', placeholder: 'e.g. HDFC AMC' },
      { key: 'folioNo', label: 'Folio number', type: 'text' },
      { key: 'scheme', label: 'Scheme', type: 'text' },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'equity', label: 'Equity' },
          { value: 'debt', label: 'Debt' },
          { value: 'hybrid', label: 'Hybrid' },
          { value: 'liquid', label: 'Liquid' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'nav', label: 'NAV (₹)', type: 'number' },
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
      { key: 'sumAssured', label: 'Sum assured (₹)', type: 'currency' },
      { key: 'premium', label: 'Premium (₹)', type: 'currency' },
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
    ],
  },

  property: {
    fields: [
      {
        key: 'propertyKind',
        label: 'Property type',
        type: 'select',
        options: [
          { value: 'residential', label: 'Residential' },
          { value: 'commercial', label: 'Commercial' },
          { value: 'land', label: 'Land / plot' },
          { value: 'other', label: 'Other' },
        ],
      },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'areaSqft', label: 'Area', type: 'number', suffix: 'sq.ft' },
      { key: 'ownershipPct', label: 'Your share', type: 'number', suffix: '%' },
      { key: 'rera', label: 'RERA / survey no.', type: 'text' },
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
      { key: 'grams', label: 'Weight', type: 'number', suffix: 'g' },
      {
        key: 'purity',
        label: 'Purity',
        type: 'select',
        options: [
          { value: '24K', label: '24K' },
          { value: '22K', label: '22K' },
          { value: '18K', label: '18K' },
          { value: 'other', label: 'Other' },
        ],
      },
    ],
  },

  crypto: {
    fields: [
      { key: 'coin', label: 'Coin / token', type: 'text', placeholder: 'e.g. BTC' },
      { key: 'platform', label: 'Exchange / wallet', type: 'text' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
    ],
  },

  epf: {
    fields: [
      { key: 'uan', label: 'UAN', type: 'text' },
      { key: 'employer', label: 'Employer', type: 'text' },
    ],
  },

  nps: {
    fields: [
      { key: 'pran', label: 'PRAN', type: 'text' },
      {
        key: 'tier',
        label: 'Tier',
        type: 'select',
        options: [
          { value: 'tier1', label: 'Tier I' },
          { value: 'tier2', label: 'Tier II' },
        ],
      },
    ],
  },

  vehicle: {
    fields: [
      { key: 'regNo', label: 'Registration no.', type: 'text' },
      { key: 'make', label: 'Make', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'year', label: 'Year', type: 'number' },
    ],
  },
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
