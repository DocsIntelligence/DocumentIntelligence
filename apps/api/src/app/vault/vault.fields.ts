/**
 * Canonical vault field keys per entity kind (docs/10). Canonical keys are what
 * make autofill mappable onto document form fields, and drive masking. This is
 * the catalog the UI renders and the autofill resolver maps from.
 */

export type VaultEntityKind = 'person' | 'company' | 'other';

export interface VaultFieldDef {
  key: string;
  label: string;
  sensitive?: boolean;
  /** Keep only the last N chars visible when masked (else fully masked). */
  revealLast?: number;
}

const PERSON_FIELDS: VaultFieldDef[] = [
  { key: 'full_name', label: 'Full name' },
  { key: 'father_name', label: "Father's / Husband's name" },
  { key: 'dob', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'aadhaar_number', label: 'Aadhaar number', sensitive: true, revealLast: 4 },
  { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4 },
  { key: 'passport_number', label: 'Passport number', sensitive: true, revealLast: 4 },
  { key: 'voter_id', label: 'Voter ID', sensitive: true, revealLast: 4 },
  { key: 'driving_licence', label: 'Driving licence', sensitive: true, revealLast: 4 },
  { key: 'phone', label: 'Phone', sensitive: true, revealLast: 4 },
  { key: 'email', label: 'Email' },
  { key: 'bank_account', label: 'Bank account number', sensitive: true, revealLast: 4 },
  { key: 'bank_ifsc', label: 'IFSC' },
  { key: 'address_line1', label: 'Address line 1' },
  { key: 'address_line2', label: 'Address line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'PIN code' },
];

const COMPANY_FIELDS: VaultFieldDef[] = [
  { key: 'legal_name', label: 'Legal name' },
  { key: 'entity_type', label: 'Entity type (Pvt Ltd / LLP / …)' },
  { key: 'cin', label: 'CIN', sensitive: true, revealLast: 4 },
  { key: 'gstin', label: 'GSTIN', sensitive: true, revealLast: 4 },
  { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4 },
  { key: 'tan', label: 'TAN', sensitive: true, revealLast: 4 },
  { key: 'incorporation_date', label: 'Incorporation date' },
  { key: 'authorised_signatory', label: 'Authorised signatory' },
  { key: 'signatory_designation', label: 'Signatory designation' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone', sensitive: true, revealLast: 4 },
  { key: 'registered_office', label: 'Registered office' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'PIN code' },
];

export function fieldDefs(kind: string): VaultFieldDef[] {
  if (kind === 'company') return COMPANY_FIELDS;
  if (kind === 'person') return PERSON_FIELDS;
  // 'other' — union of common fields.
  return [
    { key: 'name', label: 'Name' },
    { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4 },
    { key: 'gstin', label: 'GSTIN', sensitive: true, revealLast: 4 },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone', sensitive: true, revealLast: 4 },
    { key: 'address_line1', label: 'Address line 1' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'PIN code' },
  ];
}

function defByKey(kind: string): Map<string, VaultFieldDef> {
  return new Map(fieldDefs(kind).map((f) => [f.key, f]));
}

/** Mask a single sensitive value, keeping `revealLast` trailing chars. */
export function maskValue(value: string, revealLast = 0): string {
  const s = String(value);
  if (revealLast <= 0 || s.length <= revealLast) return '••••';
  return `••••${s.slice(-revealLast)}`;
}

/** Return a masked copy of the fields for safe listing/detail (sensitive keys hidden). */
export function maskFields(
  kind: string,
  fields: Record<string, unknown>,
): Record<string, string> {
  const defs = defByKey(kind);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === '') continue;
    const def = defs.get(k);
    out[k] = def?.sensitive ? maskValue(String(v), def.revealLast) : String(v);
  }
  return out;
}
