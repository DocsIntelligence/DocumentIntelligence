/**
 * Canonical vault field catalog per entity kind (docs/10). Fields are now typed
 * (text/date/select/…) and grouped (Identity/Address/Bank/…) so the UI renders
 * proper inputs (calendar for dates, dropdowns for enums) and a tidy layout.
 * Canonical keys drive both document autofill and document-scan autofill.
 */

export type VaultEntityKind =
  | 'person'
  | 'company'
  | 'lawyer'
  | 'court'
  | 'case'
  | 'property'
  | 'other';

/**
 * State Bar Councils of India — used as the dropdown options for a lawyer's
 * enrolling bar council. Kept here (instead of in the lawyer-fields literal)
 * so the list can be reused if/when we need it elsewhere.
 */
const BAR_COUNCILS = [
  'Bar Council of India',
  'Bar Council of Delhi',
  'Bar Council of Maharashtra & Goa',
  'Bar Council of Karnataka',
  'Bar Council of Tamil Nadu & Puducherry',
  'Bar Council of Kerala',
  'Bar Council of Andhra Pradesh',
  'Bar Council of Telangana',
  'Bar Council of West Bengal',
  'Bar Council of Uttar Pradesh',
  'Bar Council of Madhya Pradesh',
  'Bar Council of Rajasthan',
  'Bar Council of Gujarat',
  'Bar Council of Punjab & Haryana',
  'Bar Council of Bihar',
  'Bar Council of Jharkhand',
  'Bar Council of Chhattisgarh',
  'Bar Council of Odisha',
  'Bar Council of Assam, Nagaland, Mizoram, Arunachal Pradesh, Sikkim, Manipur, Tripura & Meghalaya',
  'Bar Council of Himachal Pradesh',
  'Bar Council of Jammu & Kashmir and Ladakh',
  'Bar Council of Uttarakhand',
];

const COURT_TYPES = [
  'Supreme Court',
  'High Court',
  'District Court',
  'Family Court',
  'Consumer Forum',
  'NCLT',
  'NCDRC',
  'ITAT',
  'CESTAT',
  'DRT',
  'Tribunal',
  'Arbitration',
  'Lok Adalat',
  'Other',
];

const CASE_NATURES = [
  'Civil',
  'Criminal',
  'Writ',
  'Appeal',
  'Revision',
  'Arbitration',
  'Family',
  'Consumer',
  'Tax',
  'IP',
  'Service',
  'Company',
  'Other',
];

const CASE_STAGES = [
  'Drafted',
  'Filed',
  'Pending admission',
  'Pending hearing',
  'Arguments',
  'Reserved',
  'Disposed',
  'Appealed',
  'Settled',
];

const PROPERTY_TYPES = [
  'Residential — flat/apartment',
  'Residential — house/villa',
  'Commercial — office',
  'Commercial — shop/showroom',
  'Industrial',
  'Agricultural land',
  'Non-agricultural plot',
  'Other',
];

const AREA_UNITS = [
  'sq.ft',
  'sq.m',
  'sq.yd',
  'acre',
  'hectare',
  'cent',
  'bigha',
  'guntha',
];

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

// ── Lawyer / advocate — used as our_counsel/opposing_counsel in cases,
//    party-counsel in vakalatnamas, signatory on legal notices. PAN/GSTIN
//    are sensitive (revealLast: 4) like in person/company. Enrollment
//    number is the canonical bar-council registration (e.g. MAH/12345/2010)
//    — not technically a secret but kept compact in the UI.
const LAWYER_FIELDS: VaultFieldDef[] = [
  { key: 'full_name', label: 'Full name', group: 'Identity' },
  { key: 'enrollment_number', label: 'Bar enrollment number', group: 'Identity', placeholder: 'MAH/12345/2010' },
  { key: 'bar_council', label: 'Bar council', type: 'select', options: BAR_COUNCILS, group: 'Identity' },
  { key: 'enrollment_date', label: 'Enrollment date', type: 'date', group: 'Identity' },
  { key: 'designation', label: 'Designation', type: 'select', options: ['Advocate', 'Senior Advocate', 'Advocate-on-Record', 'Solicitor', 'Other'], group: 'Identity' },
  { key: 'specialization', label: 'Specialization / practice area', type: 'textarea', group: 'Identity', placeholder: 'e.g. Civil, Criminal, Commercial Arbitration' },
  { key: 'pan', label: 'PAN', sensitive: true, revealLast: 4, group: 'Identity', placeholder: 'ABCDE1234F' },
  { key: 'gstin', label: 'GSTIN', sensitive: true, revealLast: 4, group: 'Identity' },
  { key: 'email', label: 'Email', type: 'email', group: 'Contact' },
  { key: 'phone', label: 'Phone', type: 'tel', sensitive: true, revealLast: 4, group: 'Contact' },
  { key: 'chamber_name', label: 'Chamber / firm name', group: 'Chamber' },
  { key: 'chamber_address', label: 'Chamber address', type: 'textarea', group: 'Chamber' },
  { key: 'city', label: 'City', group: 'Chamber' },
  { key: 'state', label: 'State', type: 'select', options: INDIAN_STATES, group: 'Chamber' },
  { key: 'pincode', label: 'PIN code', type: 'tel', group: 'Chamber' },
];

// ── Court / tribunal / forum — used for case captions, vakalatnamas,
//    notices addressed to a court, cause-title cells. Stays generic (one
//    schema for HC/SC/DC/tribunals) — type + jurisdiction + bench cover
//    the distinguishing facets without exploding the schema.
const COURT_FIELDS: VaultFieldDef[] = [
  { key: 'name', label: 'Court name', group: 'Identity', placeholder: 'e.g. Bombay High Court' },
  { key: 'court_type', label: 'Type', type: 'select', options: COURT_TYPES, group: 'Identity' },
  { key: 'jurisdiction', label: 'Jurisdiction', group: 'Identity', placeholder: 'e.g. Maharashtra at Bombay' },
  { key: 'bench', label: 'Bench / circuit', group: 'Identity', placeholder: 'e.g. Aurangabad Bench (optional)' },
  { key: 'presiding_officer', label: 'Presiding officer', group: 'Identity', placeholder: 'e.g. Hon\'ble Justice ABC' },
  { key: 'registrar_email', label: 'Registrar email', type: 'email', group: 'Contact' },
  { key: 'registrar_phone', label: 'Registrar phone', type: 'tel', group: 'Contact' },
  { key: 'website', label: 'Website', group: 'Contact', placeholder: 'https://...' },
  { key: 'registry_address', label: 'Registry address', type: 'textarea', group: 'Address' },
  { key: 'city', label: 'City', group: 'Address' },
  { key: 'state', label: 'State', type: 'select', options: INDIAN_STATES, group: 'Address' },
  { key: 'pincode', label: 'PIN code', type: 'tel', group: 'Address' },
];

// ── Case / matter — pending or referenced. Drives cause-title autofill,
//    "in re ..." references, and is the natural Vault home for matter
//    tracking even though we don't (yet) build a full case-management
//    surface on top of it.
const CASE_FIELDS: VaultFieldDef[] = [
  { key: 'title', label: 'Cause title', group: 'Matter', placeholder: 'e.g. Ramesh vs. State of Maharashtra' },
  { key: 'case_number', label: 'Case number', group: 'Matter', placeholder: 'e.g. CRWP/2023/12345' },
  { key: 'court_name', label: 'Court', group: 'Matter', placeholder: 'e.g. Bombay High Court' },
  { key: 'bench', label: 'Bench', group: 'Matter' },
  { key: 'case_nature', label: 'Nature', type: 'select', options: CASE_NATURES, group: 'Matter' },
  { key: 'case_stage', label: 'Stage', type: 'select', options: CASE_STAGES, group: 'Matter' },
  { key: 'filing_date', label: 'Filing date', type: 'date', group: 'Dates' },
  { key: 'next_hearing', label: 'Next hearing', type: 'date', group: 'Dates' },
  { key: 'our_party', label: 'Our party', group: 'Parties' },
  { key: 'opposing_party', label: 'Opposing party', group: 'Parties' },
  { key: 'our_counsel', label: 'Our counsel', group: 'Parties' },
  { key: 'opposing_counsel', label: 'Opposing counsel', group: 'Parties' },
  { key: 'subject_matter', label: 'Subject matter', type: 'textarea', group: 'Notes' },
  { key: 'notes', label: 'Notes', type: 'textarea', group: 'Notes' },
];

// ── Property — the most common autofill target after Person/Company.
//    Rent agreements, sale deeds, gift deeds, lease, partition deeds and
//    leave-and-licence all need property identity + address + area in a
//    structured form. India-specific land-record fields (khasra / khatauni
//    / khewat / mauza / tehsil / CTS / RERA) sit in their own group so
//    they don't clutter the common Address+Details block; international
//    identifiers (Parcel ID / APN / Title no. / Cadastral ref) are kept
//    in a parallel group for non-India users.
const PROPERTY_FIELDS: VaultFieldDef[] = [
  { key: 'property_name', label: 'Friendly name', group: 'Identity', placeholder: 'e.g. Flat 304 Andheri West' },
  { key: 'property_type', label: 'Type', type: 'select', options: PROPERTY_TYPES, group: 'Identity' },
  { key: 'owner_name', label: 'Registered owner', group: 'Identity' },
  { key: 'address_line1', label: 'Address line 1', group: 'Address' },
  { key: 'address_line2', label: 'Address line 2', group: 'Address' },
  { key: 'landmark', label: 'Landmark / locality', group: 'Address' },
  { key: 'city', label: 'City / town', group: 'Address' },
  { key: 'district', label: 'District', group: 'Address' },
  { key: 'state', label: 'State / province', type: 'select', options: INDIAN_STATES, group: 'Address' },
  { key: 'country', label: 'Country', group: 'Address', placeholder: 'India' },
  { key: 'pincode', label: 'PIN / ZIP code', type: 'tel', group: 'Address' },
  // Most-used physical/structural details — kept above the records groups
  // so users filling rent/sale common fields don't have to scroll.
  { key: 'area_value', label: 'Area', type: 'number', group: 'Details' },
  { key: 'area_unit', label: 'Area unit', type: 'select', options: AREA_UNITS, group: 'Details' },
  { key: 'bhk', label: 'BHK / configuration', group: 'Details', placeholder: 'e.g. 2BHK' },
  { key: 'built_up_area', label: 'Built-up area (sq.ft)', type: 'number', group: 'Details' },
  { key: 'carpet_area', label: 'Carpet area (sq.ft)', type: 'number', group: 'Details' },
  { key: 'floor', label: 'Floor / level', group: 'Details', placeholder: 'e.g. 3 of 12' },
  { key: 'facing', label: 'Facing', type: 'select', options: ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'], group: 'Details' },
  // ── Government registration: anything issued by a public registrar
  //    that gives the property a legal identity. RERA is India-specific
  //    but property tax ID and registration number generalise globally.
  { key: 'registration_number', label: 'Registration / document number', group: 'Government registration', placeholder: 'e.g. BAN-1-3456/2023' },
  { key: 'registration_date', label: 'Registration date', type: 'date', group: 'Government registration' },
  { key: 'sro_office', label: 'Sub-registrar office (SRO)', group: 'Government registration', placeholder: 'e.g. SRO Andheri' },
  { key: 'rera_number', label: 'RERA registration no. (India)', group: 'Government registration', placeholder: 'e.g. P51800000123' },
  { key: 'property_id', label: 'Municipal property ID / Tax ID', group: 'Government registration', placeholder: 'e.g. PID 25-AB-001' },
  { key: 'mutation_number', label: 'Mutation no.', group: 'Government registration' },
  // ── Indian land records — revenue / urban-land identifiers. Used in
  //    sale deeds, partition deeds, agricultural land transactions, and
  //    any deed touching a parcel of land (vs. an apartment unit).
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
  // ── Cadastral / title identifiers — generic across jurisdictions.
  //    Most countries have at least one of these; users outside India
  //    use this group instead of the khasra/khatauni block.
  { key: 'parcel_id', label: 'Parcel ID / APN', group: 'Cadastral / Title (worldwide)', placeholder: 'US: Assessor Parcel Number' },
  { key: 'title_number', label: 'Title / Folio no.', group: 'Cadastral / Title (worldwide)', placeholder: 'UK/AU: Land title number' },
  { key: 'cadastral_reference', label: 'Cadastral reference', group: 'Cadastral / Title (worldwide)', placeholder: 'EU / Latin America' },
  { key: 'lot_block', label: 'Lot / Block', group: 'Cadastral / Title (worldwide)', placeholder: 'e.g. Lot 5, Block 12' },
  { key: 'deed_reference', label: 'Deed book / page', group: 'Cadastral / Title (worldwide)', placeholder: 'US: Book 124, Page 456' },
  { key: 'plan_number', label: 'Plan / DP no.', group: 'Cadastral / Title (worldwide)', placeholder: 'AU/NZ: Deposited Plan number' },
];

export function fieldDefs(kind: string): VaultFieldDef[] {
  switch (kind) {
    case 'person': return PERSON_FIELDS;
    case 'company': return COMPANY_FIELDS;
    case 'lawyer': return LAWYER_FIELDS;
    case 'court': return COURT_FIELDS;
    case 'case': return CASE_FIELDS;
    case 'property': return PROPERTY_FIELDS;
    case 'other':
    default: return OTHER_FIELDS;
  }
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
  // Lawyer-side: the Bar Council enrollment certificate is the canonical
  // proof of practice — fills the lawyer entity's identity fields.
  { kind: 'bar_enrollment', label: 'Bar enrollment certificate', fills: ['full_name', 'enrollment_number', 'bar_council', 'enrollment_date'] },
  // Property-side scans — sale deed / 7-12 extract / property card. Fills
  // the registration + survey + ownership trio + address.
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
