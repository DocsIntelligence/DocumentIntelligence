/**
 * Canonical vault field catalog per entity kind (docs/10). Fields are now typed
 * (text/date/select/…) and grouped (Identity/Address/Bank/…) so the UI renders
 * proper inputs (calendar for dates, dropdowns for enums) and a tidy layout.
 * Canonical keys drive both document autofill and document-scan autofill.
 */

export type VaultEntityKind = 'person' | 'company' | 'other';

export type VaultFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'tel'
  | 'email'
  | 'select'
  | 'lookup';

export interface VaultFieldDef {
  key: string;
  label: string;
  type?: VaultFieldType;
  /** Section grouping for the UI, e.g. 'Identity' | 'Address' | 'Bank'. */
  group?: string;
  /** Options for a `select` field. */
  options?: string[];
  /** When type='lookup', the LookupGroup key (e.g. 'country', 'state'). */
  lookupKey?: string;
  sensitive?: boolean;
  /** Keep only the last N chars visible when masked (else fully masked). */
  revealLast?: number;
  placeholder?: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
  'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep',
];

const PERSON_FIELDS: VaultFieldDef[] = [
  { key: 'full_name', label: 'Full name', group: 'Identity' },
  { key: 'father_name', label: "Father's / Husband's name", group: 'Identity' },
  { key: 'dob', label: 'Date of birth', type: 'date', group: 'Identity' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], group: 'Identity' },
  { key: 'aadhaar_number', label: 'Aadhaar number', type: 'tel', sensitive: true, revealLast: 4, group: 'Identity', placeholder: '1234 5678 9012' },
  { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4, group: 'Identity', placeholder: 'ABCDE1234F' },
  { key: 'passport_number', label: 'Passport number', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'voter_id', label: 'Voter ID', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'driving_licence', label: 'Driving licence', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'phone', label: 'Phone', type: 'tel', sensitive: true, revealLast: 4, group: 'Contact' },
  { key: 'email', label: 'Email', type: 'email', group: 'Contact' },
  { key: 'address_line1', label: 'Address line 1', group: 'Address' },
  { key: 'address_line2', label: 'Address line 2', group: 'Address' },
  { key: 'city', label: 'City', group: 'Address' },
  { key: 'state', label: 'State', type: 'select', options: INDIAN_STATES, group: 'Address' },
  { key: 'pincode', label: 'PIN code', type: 'tel', group: 'Address' },
  { key: 'bank_account', label: 'Bank account number', sensitive: true, revealLast: 4, group: 'Bank' },
  { key: 'bank_ifsc', label: 'IFSC', group: 'Bank' },
];

const COMPANY_FIELDS: VaultFieldDef[] = [
  { key: 'legal_name', label: 'Legal name', group: 'Identity' },
  { key: 'entity_type', label: 'Entity type', type: 'select', options: ['Private Limited', 'Public Limited', 'LLP', 'OPC', 'Partnership', 'Proprietorship', 'Trust', 'Society', 'HUF'], group: 'Identity' },
  { key: 'cin', label: 'CIN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'gstin', label: 'GSTIN', sensitive: true, revealLast: 4, group: 'Identity', placeholder: '22AAAAA0000A1Z5' },
  { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'tan', label: 'TAN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'incorporation_date', label: 'Incorporation date', type: 'date', group: 'Identity' },
  { key: 'authorised_signatory', label: 'Authorised signatory', group: 'Contact' },
  { key: 'signatory_designation', label: 'Signatory designation', group: 'Contact' },
  { key: 'email', label: 'Email', type: 'email', group: 'Contact' },
  { key: 'phone', label: 'Phone', type: 'tel', sensitive: true, revealLast: 4, group: 'Contact' },
  { key: 'registered_office', label: 'Registered office', type: 'textarea', group: 'Address' },
  { key: 'city', label: 'City', group: 'Address' },
  { key: 'state', label: 'State', type: 'select', options: INDIAN_STATES, group: 'Address' },
  { key: 'pincode', label: 'PIN code', type: 'tel', group: 'Address' },
];

const OTHER_FIELDS: VaultFieldDef[] = [
  { key: 'name', label: 'Name', group: 'Identity' },
  { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'gstin', label: 'GSTIN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'email', label: 'Email', type: 'email', group: 'Contact' },
  { key: 'phone', label: 'Phone', type: 'tel', sensitive: true, revealLast: 4, group: 'Contact' },
  { key: 'address_line1', label: 'Address line 1', group: 'Address' },
  { key: 'city', label: 'City', group: 'Address' },
  { key: 'state', label: 'State', type: 'select', options: INDIAN_STATES, group: 'Address' },
  { key: 'pincode', label: 'PIN code', type: 'tel', group: 'Address' },
];

export function fieldDefs(kind: string): VaultFieldDef[] {
  if (kind === 'company') return COMPANY_FIELDS;
  if (kind === 'person') return PERSON_FIELDS;
  return OTHER_FIELDS;
}

export function maskValue(value: string, revealLast = 0): string {
  const s = String(value);
  if (revealLast <= 0 || s.length <= revealLast) return '••••';
  return `••••${s.slice(-revealLast)}`;
}

export function maskFields(
  defs: VaultFieldDef[],
  fields: Record<string, unknown>,
): Record<string, string> {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null || v === '') continue;
    const def = byKey.get(k);
    out[k] = def?.sensitive ? maskValue(String(v), def.revealLast) : String(v);
  }
  return out;
}

// ── Document-kind → the canonical fields a scan of it can fill (docs/10 Part B) ──

export interface VaultDocKind {
  kind: string;
  label: string;
  /** Canonical field keys this document can populate via scan-autofill. */
  fills: string[];
}

export const VAULT_DOC_KINDS: VaultDocKind[] = [
  { kind: 'aadhaar', label: 'Aadhaar card', fills: ['full_name', 'aadhaar_number', 'dob', 'gender', 'father_name', 'address_line1', 'city', 'state', 'pincode'] },
  { kind: 'pan', label: 'PAN card', fills: ['full_name', 'pan', 'dob', 'father_name'] },
  { kind: 'passport', label: 'Passport', fills: ['full_name', 'passport_number', 'dob', 'gender'] },
  { kind: 'voter_id', label: 'Voter ID', fills: ['full_name', 'voter_id', 'father_name'] },
  { kind: 'driving_licence', label: 'Driving licence', fills: ['full_name', 'driving_licence', 'dob', 'address_line1'] },
  { kind: 'gst', label: 'GST certificate', fills: ['legal_name', 'gstin', 'pan', 'registered_office'] },
  { kind: 'incorporation', label: 'Incorporation certificate', fills: ['legal_name', 'cin', 'incorporation_date'] },
  { kind: 'bank', label: 'Bank passbook / cheque', fills: ['bank_account', 'bank_ifsc', 'full_name'] },
  { kind: 'other', label: 'Other', fills: [] },
];

export function docKind(kind: string): VaultDocKind | undefined {
  return VAULT_DOC_KINDS.find((k) => k.kind === kind);
}
