/**
 * Canonical vault catalog (docs/10). Three tables seed from this file on
 * first boot:
 *
 *   1. VaultEntityKindConfig — the entity kinds (person / lawyer / …).
 *   2. VaultFieldConfig      — the global pool of fields (full_name, pan, …).
 *   3. VaultEntityKindField  — which fields each kind exposes (the join).
 *
 * Fields are deduplicated across kinds: `pan` is one row used by Person +
 * Company + Lawyer + Other (rather than four near-identical rows). The
 * per-kind ordering + optional group override live on the join row.
 */

export type VaultEntityKind =
  | 'person'
  | 'company'
  | 'lawyer'
  | 'court'
  | 'case'
  | 'property'
  | 'other';

export type VaultBadgeVariant =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'warning'
  | 'success';

export interface VaultEntityKindDef {
  key: string;
  label: string;
  badgeVariant: VaultBadgeVariant;
  sortOrder: number;
}

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

export interface VaultEntityKindFieldDef {
  /** field.key referenced from this entity kind. */
  key: string;
  /** Per-kind group override (else field.group is used). */
  group?: string;
}

// ── Entity kinds (the catalogue of types the Vault tracks) ──────────────

export const VAULT_ENTITY_KINDS: VaultEntityKindDef[] = [
  { key: 'person',   label: 'Person',   badgeVariant: 'primary',   sortOrder: 0 },
  { key: 'company',  label: 'Company',  badgeVariant: 'secondary', sortOrder: 1 },
  { key: 'lawyer',   label: 'Lawyer',   badgeVariant: 'info',      sortOrder: 2 },
  { key: 'court',    label: 'Court',    badgeVariant: 'warning',   sortOrder: 3 },
  { key: 'case',     label: 'Case',     badgeVariant: 'info',      sortOrder: 4 },
  { key: 'property', label: 'Property', badgeVariant: 'success',   sortOrder: 5 },
  { key: 'other',    label: 'Other',    badgeVariant: 'secondary', sortOrder: 6 },
];

// ── Global field pool (one row per canonical key, reused across kinds) ─

/**
 * The canonical fields. Each key appears once. Per-kind ordering and any
 * group override live in VAULT_KIND_FIELDS below.
 */
export const VAULT_FIELDS: VaultFieldDef[] = [
  // Generic-name fields (kinds use a single one of these; never multiple)
  { key: 'full_name', label: 'Full name', group: 'Identity' },
  { key: 'legal_name', label: 'Legal name', group: 'Identity' },
  { key: 'name', label: 'Name', group: 'Identity' },
  { key: 'property_name', label: 'Friendly name', group: 'Identity', placeholder: 'e.g. Flat 304 Andheri West' },
  { key: 'title', label: 'Cause title', group: 'Matter', placeholder: 'e.g. Ramesh vs. State of Maharashtra' },

  // Identity / personal
  { key: 'father_name', label: "Father's / Husband's name", group: 'Identity' },
  { key: 'dob', label: 'Date of birth', type: 'date', group: 'Identity' },
  { key: 'gender', label: 'Gender', type: 'lookup', lookupKey: 'gender', group: 'Identity' },

  // Sensitive identifiers
  { key: 'aadhaar_number', label: 'Aadhaar number', type: 'tel', sensitive: true, revealLast: 4, group: 'Identity', placeholder: '1234 5678 9012' },
  { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4, group: 'Identity', placeholder: 'ABCDE1234F' },
  { key: 'passport_number', label: 'Passport number', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'voter_id', label: 'Voter ID', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'driving_licence', label: 'Driving licence', sensitive: true, revealLast: 4, group: 'Identity' },

  // Company identifiers
  { key: 'entity_type', label: 'Entity type', type: 'lookup', lookupKey: 'entity_type', group: 'Identity' },
  { key: 'cin', label: 'CIN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'gstin', label: 'GSTIN', sensitive: true, revealLast: 4, group: 'Identity', placeholder: '22AAAAA0000A1Z5' },
  { key: 'tan', label: 'TAN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'incorporation_date', label: 'Incorporation date', type: 'date', group: 'Identity' },
  { key: 'authorised_signatory', label: 'Authorised signatory', group: 'Contact' },
  { key: 'signatory_designation', label: 'Signatory designation', group: 'Contact' },

  // Contact (shared)
  { key: 'phone', label: 'Phone', type: 'tel', sensitive: true, revealLast: 4, group: 'Contact' },
  { key: 'email', label: 'Email', type: 'email', group: 'Contact' },
  { key: 'website', label: 'Website', group: 'Contact', placeholder: 'https://...' },

  // Address (shared)
  { key: 'address_line1', label: 'Address line 1', group: 'Address' },
  { key: 'address_line2', label: 'Address line 2', group: 'Address' },
  { key: 'landmark', label: 'Landmark / locality', group: 'Address' },
  { key: 'city', label: 'City / town', group: 'Address' },
  { key: 'district', label: 'District', group: 'Address' },
  { key: 'state', label: 'State / province', type: 'lookup', lookupKey: 'in_states', group: 'Address' },
  { key: 'country', label: 'Country', type: 'lookup', lookupKey: 'country', group: 'Address' },
  { key: 'pincode', label: 'PIN / ZIP code', type: 'tel', group: 'Address' },
  { key: 'registered_office', label: 'Registered office', type: 'textarea', group: 'Address' },

  // Bank
  { key: 'bank_account', label: 'Bank account number', sensitive: true, revealLast: 4, group: 'Bank' },
  { key: 'bank_ifsc', label: 'IFSC', group: 'Bank' },

  // Lawyer-specific
  { key: 'enrollment_number', label: 'Bar enrollment number', group: 'Identity', placeholder: 'MAH/12345/2010' },
  { key: 'bar_council', label: 'Bar council', type: 'lookup', lookupKey: 'bar_council', group: 'Identity' },
  { key: 'enrollment_date', label: 'Enrollment date', type: 'date', group: 'Identity' },
  { key: 'designation', label: 'Designation', type: 'lookup', lookupKey: 'lawyer_designation', group: 'Identity' },
  { key: 'specialization', label: 'Specialization / practice area', type: 'textarea', group: 'Identity', placeholder: 'e.g. Civil, Criminal, Commercial Arbitration' },
  { key: 'chamber_name', label: 'Chamber / firm name', group: 'Chamber' },
  { key: 'chamber_address', label: 'Chamber address', type: 'textarea', group: 'Chamber' },

  // Court-specific
  { key: 'court_type', label: 'Type', type: 'lookup', lookupKey: 'court_type', group: 'Identity' },
  { key: 'jurisdiction', label: 'Jurisdiction', group: 'Identity', placeholder: 'e.g. Maharashtra at Bombay' },
  { key: 'bench', label: 'Bench / circuit', group: 'Identity', placeholder: 'e.g. Aurangabad Bench (optional)' },
  { key: 'presiding_officer', label: 'Presiding officer', group: 'Identity', placeholder: 'e.g. Hon\'ble Justice ABC' },
  { key: 'registrar_email', label: 'Registrar email', type: 'email', group: 'Contact' },
  { key: 'registrar_phone', label: 'Registrar phone', type: 'tel', group: 'Contact' },
  { key: 'registry_address', label: 'Registry address', type: 'textarea', group: 'Address' },

  // Case-specific
  { key: 'case_number', label: 'Case number', group: 'Matter', placeholder: 'e.g. CRWP/2023/12345' },
  { key: 'court_name', label: 'Court', group: 'Matter', placeholder: 'e.g. Bombay High Court' },
  { key: 'case_nature', label: 'Nature', type: 'lookup', lookupKey: 'case_nature', group: 'Matter' },
  { key: 'case_stage', label: 'Stage', type: 'lookup', lookupKey: 'case_stage', group: 'Matter' },
  { key: 'filing_date', label: 'Filing date', type: 'date', group: 'Dates' },
  { key: 'next_hearing', label: 'Next hearing', type: 'date', group: 'Dates' },
  { key: 'our_party', label: 'Our party', group: 'Parties' },
  { key: 'opposing_party', label: 'Opposing party', group: 'Parties' },
  { key: 'our_counsel', label: 'Our counsel', group: 'Parties' },
  { key: 'opposing_counsel', label: 'Opposing counsel', group: 'Parties' },
  { key: 'subject_matter', label: 'Subject matter', type: 'textarea', group: 'Notes' },
  { key: 'notes', label: 'Notes', type: 'textarea', group: 'Notes' },

  // Property — common
  { key: 'property_type', label: 'Type', type: 'lookup', lookupKey: 'property_type', group: 'Identity' },
  { key: 'owner_name', label: 'Registered owner', group: 'Identity' },
  { key: 'area_value', label: 'Area', type: 'number', group: 'Details' },
  { key: 'area_unit', label: 'Area unit', type: 'lookup', lookupKey: 'area_unit', group: 'Details' },
  { key: 'bhk', label: 'BHK / configuration', group: 'Details', placeholder: 'e.g. 2BHK' },
  { key: 'built_up_area', label: 'Built-up area (sq.ft)', type: 'number', group: 'Details' },
  { key: 'carpet_area', label: 'Carpet area (sq.ft)', type: 'number', group: 'Details' },
  { key: 'floor', label: 'Floor / level', group: 'Details', placeholder: 'e.g. 3 of 12' },
  { key: 'facing', label: 'Facing', type: 'lookup', lookupKey: 'facing_direction', group: 'Details' },

  // Property — government registration
  { key: 'registration_number', label: 'Registration / document number', group: 'Government registration', placeholder: 'e.g. BAN-1-3456/2023' },
  { key: 'registration_date', label: 'Registration date', type: 'date', group: 'Government registration' },
  { key: 'sro_office', label: 'Sub-registrar office (SRO)', group: 'Government registration', placeholder: 'e.g. SRO Andheri' },
  { key: 'rera_number', label: 'RERA registration no. (India)', group: 'Government registration', placeholder: 'e.g. P51800000123' },
  { key: 'property_id', label: 'Municipal property ID / Tax ID', group: 'Government registration', placeholder: 'e.g. PID 25-AB-001' },
  { key: 'mutation_number', label: 'Mutation no.', group: 'Government registration' },

  // Property — Indian land records
  { key: 'survey_number', label: 'Survey no.', group: 'Land records (India)', placeholder: 'e.g. 145/2A' },
  { key: 'khasra_number', label: 'Khasra no.', group: 'Land records (India)' },
  { key: 'khatauni_number', label: 'Khatauni no.', group: 'Land records (India)' },
  { key: 'khewat_number', label: 'Khewat no.', group: 'Land records (India)' },
  { key: 'hissa_number', label: 'Hissa no.', group: 'Land records (India)' },
  { key: 'mauza', label: 'Mauza / village', group: 'Land records (India)' },
  { key: 'tehsil', label: 'Tehsil / taluk / mandal', group: 'Land records (India)' },
  { key: 'cts_number', label: 'City Survey (CTS) no.', group: 'Land records (India)', placeholder: 'Urban Maharashtra/Karnataka' },
  { key: 'final_plot_number', label: 'Final Plot no. (FPN) / TPS no.', group: 'Land records (India)' },
  { key: 'patta_number', label: 'Patta / pattadar no.', group: 'Land records (India)' },

  // Property — cadastral / worldwide
  { key: 'parcel_id', label: 'Parcel ID / APN', group: 'Cadastral / Title (worldwide)', placeholder: 'US: Assessor Parcel Number' },
  { key: 'title_number', label: 'Title / Folio no.', group: 'Cadastral / Title (worldwide)', placeholder: 'UK/AU: Land title number' },
  { key: 'cadastral_reference', label: 'Cadastral reference', group: 'Cadastral / Title (worldwide)', placeholder: 'EU / Latin America' },
  { key: 'lot_block', label: 'Lot / Block', group: 'Cadastral / Title (worldwide)', placeholder: 'e.g. Lot 5, Block 12' },
  { key: 'deed_reference', label: 'Deed book / page', group: 'Cadastral / Title (worldwide)', placeholder: 'US: Book 124, Page 456' },
  { key: 'plan_number', label: 'Plan / DP no.', group: 'Cadastral / Title (worldwide)', placeholder: 'AU/NZ: Deposited Plan number' },
];

const FIELD_BY_KEY = new Map(VAULT_FIELDS.map((f) => [f.key, f]));

// ── Which fields each entity kind exposes (the join) ────────────────────

export const VAULT_KIND_FIELDS: Record<string, VaultEntityKindFieldDef[]> = {
  person: [
    { key: 'full_name' },
    { key: 'father_name' },
    { key: 'dob' },
    { key: 'gender' },
    { key: 'aadhaar_number' },
    { key: 'pan' },
    { key: 'passport_number' },
    { key: 'voter_id' },
    { key: 'driving_licence' },
    { key: 'phone' },
    { key: 'email' },
    { key: 'address_line1' },
    { key: 'address_line2' },
    { key: 'city' },
    { key: 'state' },
    { key: 'pincode' },
    { key: 'bank_account' },
    { key: 'bank_ifsc' },
  ],
  company: [
    { key: 'legal_name' },
    { key: 'entity_type' },
    { key: 'cin' },
    { key: 'gstin' },
    { key: 'pan' },
    { key: 'tan' },
    { key: 'incorporation_date' },
    { key: 'authorised_signatory' },
    { key: 'signatory_designation' },
    { key: 'email' },
    { key: 'phone' },
    { key: 'registered_office' },
    { key: 'city' },
    { key: 'state' },
    { key: 'pincode' },
  ],
  lawyer: [
    { key: 'full_name' },
    { key: 'enrollment_number' },
    { key: 'bar_council' },
    { key: 'enrollment_date' },
    { key: 'designation' },
    { key: 'specialization' },
    { key: 'pan' },
    { key: 'gstin' },
    { key: 'email' },
    { key: 'phone' },
    { key: 'chamber_name' },
    { key: 'chamber_address' },
    { key: 'city', group: 'Chamber' },
    { key: 'state', group: 'Chamber' },
    { key: 'pincode', group: 'Chamber' },
  ],
  court: [
    { key: 'name' },
    { key: 'court_type' },
    { key: 'jurisdiction' },
    { key: 'bench' },
    { key: 'presiding_officer' },
    { key: 'registrar_email' },
    { key: 'registrar_phone' },
    { key: 'website' },
    { key: 'registry_address' },
    { key: 'city' },
    { key: 'state' },
    { key: 'pincode' },
  ],
  case: [
    { key: 'title' },
    { key: 'case_number' },
    { key: 'court_name' },
    { key: 'bench' },
    { key: 'case_nature' },
    { key: 'case_stage' },
    { key: 'filing_date' },
    { key: 'next_hearing' },
    { key: 'our_party' },
    { key: 'opposing_party' },
    { key: 'our_counsel' },
    { key: 'opposing_counsel' },
    { key: 'subject_matter' },
    { key: 'notes' },
  ],
  property: [
    { key: 'property_name' },
    { key: 'property_type' },
    { key: 'owner_name' },
    { key: 'address_line1' },
    { key: 'address_line2' },
    { key: 'landmark' },
    { key: 'city' },
    { key: 'district' },
    { key: 'state' },
    { key: 'country' },
    { key: 'pincode' },
    { key: 'area_value' },
    { key: 'area_unit' },
    { key: 'bhk' },
    { key: 'built_up_area' },
    { key: 'carpet_area' },
    { key: 'floor' },
    { key: 'facing' },
    { key: 'registration_number' },
    { key: 'registration_date' },
    { key: 'sro_office' },
    { key: 'rera_number' },
    { key: 'property_id' },
    { key: 'mutation_number' },
    { key: 'survey_number' },
    { key: 'khasra_number' },
    { key: 'khatauni_number' },
    { key: 'khewat_number' },
    { key: 'hissa_number' },
    { key: 'mauza' },
    { key: 'tehsil' },
    { key: 'cts_number' },
    { key: 'final_plot_number' },
    { key: 'patta_number' },
    { key: 'parcel_id' },
    { key: 'title_number' },
    { key: 'cadastral_reference' },
    { key: 'lot_block' },
    { key: 'deed_reference' },
    { key: 'plan_number' },
  ],
  other: [
    { key: 'name' },
    { key: 'pan' },
    { key: 'gstin' },
    { key: 'email' },
    { key: 'phone' },
    { key: 'address_line1' },
    { key: 'city' },
    { key: 'state' },
    { key: 'pincode' },
  ],
};

/**
 * Code-default resolver — return the ordered, group-merged field defs
 * for a given entity kind. The DB-backed resolver in VaultConfigService
 * uses the same shape; this is the ultimate fallback for kinds that
 * have no DB row (or in tests).
 */
export function fieldDefs(kind: string): VaultFieldDef[] {
  const links = VAULT_KIND_FIELDS[kind] ?? [];
  const out: VaultFieldDef[] = [];
  for (const link of links) {
    const field = FIELD_BY_KEY.get(link.key);
    if (!field) continue;
    out.push(link.group ? { ...field, group: link.group } : field);
  }
  return out;
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

// ── Document-kind → the canonical fields a scan of it can fill ──────────

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
  { kind: 'bar_enrollment', label: 'Bar enrollment certificate', fills: ['full_name', 'enrollment_number', 'bar_council', 'enrollment_date'] },
  { kind: 'sale_deed', label: 'Sale deed', fills: ['property_name', 'registration_number', 'registration_date', 'sro_office', 'owner_name', 'address_line1', 'city', 'state', 'pincode', 'survey_number', 'khasra_number'] },
  { kind: 'property_card', label: 'Property card / 7-12 extract', fills: ['survey_number', 'khasra_number', 'khatauni_number', 'owner_name', 'area_value', 'area_unit', 'address_line1', 'city', 'state', 'tehsil', 'district', 'mauza'] },
  { kind: 'khasra_khatauni', label: 'Khasra / Khatauni extract', fills: ['khasra_number', 'khatauni_number', 'khewat_number', 'hissa_number', 'mauza', 'tehsil', 'district', 'state', 'owner_name', 'area_value', 'area_unit'] },
  { kind: 'property_tax_receipt', label: 'Property tax receipt', fills: ['property_id', 'owner_name', 'address_line1', 'city', 'state', 'pincode'] },
  { kind: 'rera_certificate', label: 'RERA certificate', fills: ['rera_number', 'property_name', 'address_line1', 'city', 'state', 'pincode'] },
  { kind: 'other', label: 'Other', fills: [] },
];

export function docKind(kind: string): VaultDocKind | undefined {
  return VAULT_DOC_KINDS.find((k) => k.kind === kind);
}
