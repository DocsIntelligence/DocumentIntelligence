/**
 * Map a vault entity's canonical fields onto a document section's form-field
 * paths (docs/10 autofill). The leaf segment of each form path (e.g.
 * `parties.landlord.name` → `name`) is matched to a canonical vault key by a
 * synonym table, so the same entity fills landlord, tenant, deponent, etc.
 */

/** leaf-name (normalised) → ordered canonical vault keys to try. */
const LEAF_TO_CANONICAL: Record<string, string[]> = {
  name: ['full_name', 'legal_name', 'name'],
  fullname: ['full_name', 'legal_name', 'name'],
  legalname: ['legal_name', 'full_name'],
  parentname: ['father_name'],
  fathername: ['father_name'],
  father: ['father_name'],
  husbandname: ['father_name'],
  address: ['address_line1', 'registered_office'],
  addressline1: ['address_line1', 'registered_office'],
  address1: ['address_line1', 'registered_office'],
  line1: ['address_line1'],
  registeredoffice: ['registered_office', 'address_line1'],
  addressline2: ['address_line2'],
  address2: ['address_line2'],
  line2: ['address_line2'],
  city: ['city'],
  state: ['state'],
  pin: ['pincode'],
  pincode: ['pincode'],
  postalcode: ['pincode'],
  zip: ['pincode'],
  aadhaar: ['aadhaar_number'],
  aadhaarnumber: ['aadhaar_number'],
  uid: ['aadhaar_number'],
  pan: ['pan'],
  panno: ['pan'],
  gstin: ['gstin'],
  gst: ['gstin'],
  gstno: ['gstin'],
  cin: ['cin'],
  tan: ['tan'],
  email: ['email'],
  phone: ['phone'],
  mobile: ['phone'],
  contact: ['phone'],
  phoneno: ['phone'],
  dob: ['dob'],
  dateofbirth: ['dob'],
  ifsc: ['bank_ifsc'],
  account: ['bank_account'],
  accountno: ['bank_account'],
  bankaccount: ['bank_account'],
  designation: ['signatory_designation'],
  signatory: ['authorised_signatory'],
  authorisedsignatory: ['authorised_signatory'],
  passport: ['passport_number'],
  passportnumber: ['passport_number'],
};

function leafOf(path: string): string {
  const seg = path.split('.').pop() ?? path;
  return seg.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Given the entity's canonical fields and a section's form-field paths, return
 * the `[path, value]` pairs to apply. Only paths whose leaf maps to a present
 * canonical value are returned.
 */
export function mapToSection(
  canonical: Record<string, string>,
  paths: string[],
): [string, string][] {
  const out: [string, string][] = [];
  for (const path of paths) {
    const candidates = LEAF_TO_CANONICAL[leafOf(path)];
    if (!candidates) continue;
    const key = candidates.find((c) => canonical[c]?.trim());
    if (key) out.push([path, canonical[key]]);
  }
  return out;
}
