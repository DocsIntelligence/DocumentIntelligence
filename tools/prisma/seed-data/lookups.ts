type LookupSeed = {
  key: string;
  name: string;
  description: string;
  values: Array<{ label: string; value: string; order: number }>;
};

function toValues(
  items: Array<string | { label: string; value: string }>,
): LookupSeed['values'] {
  return items.map((item, i) => {
    if (typeof item === 'string') {
      const value = item
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return { label: item, value, order: i };
    }
    return { label: item.label, value: item.value.toLowerCase(), order: i };
  });
}

export const lookupGroups: LookupSeed[] = [
  {
    key: 'currency',
    name: 'Currency',
    description: 'ISO 4217 currency codes',
    // Literal (NOT toValues, which lowercases) — values must stay uppercase ISO
    // codes: Intl.NumberFormat and the Zod currency enums expect 'INR'/'USD'/…
    values: (
      [
        ['₹ INR', 'INR'],
        ['$ USD', 'USD'],
        ['€ EUR', 'EUR'],
        ['£ GBP', 'GBP'],
        ['AED', 'AED'],
        ['S$ SGD', 'SGD'],
        ['A$ AUD', 'AUD'],
        ['C$ CAD', 'CAD'],
      ] as Array<[string, string]>
    ).map(([label, value], i) => ({ label, value, order: i })),
  },
  {
    key: 'country',
    name: 'Country',
    description: 'Countries',
    values: toValues([
      'India',
      'United States',
      'United Kingdom',
      'Canada',
      'Australia',
      'Germany',
      'France',
      'Singapore',
      'United Arab Emirates',
      'Netherlands',
      'Other',
    ]),
  },
  {
    key: 'plan-interval',
    name: 'Plan Interval',
    description: 'Billing intervals for subscription plans',
    values: toValues([
      { label: 'Daily', value: 'daily' },
      { label: 'Weekly', value: 'weekly' },
      { label: 'Monthly', value: 'monthly' },
      { label: 'Quarterly', value: 'quarterly' },
      { label: 'Yearly', value: 'yearly' },
    ]),
  },
  {
    key: 'party_relation',
    name: 'Parentage / relation',
    description: 'S/o, D/o, W/o, C/o — case-sensitive, used across documents',
    // Literal — values keep their exact case/slash to match the Zod enums.
    values: (
      [
        ['Son of (S/o)', 'S/o'],
        ['Daughter of (D/o)', 'D/o'],
        ['Wife of (W/o)', 'W/o'],
        ['Care of (C/o)', 'C/o'],
      ] as Array<[string, string]>
    ).map(([label, value], i) => ({ label, value, order: i })),
  },
  {
    key: 'paid_by',
    name: 'Paid by',
    description: 'Who bears a charge (tenancy utilities, etc.)',
    values: toValues([
      { label: 'Landlord', value: 'landlord' },
      { label: 'Tenant', value: 'tenant' },
      { label: 'Shared', value: 'shared' },
    ]),
  },
  {
    key: 'entity_type',
    name: 'Entity type',
    description: 'Legal nature of a party',
    values: toValues([
      { label: 'Individual', value: 'individual' },
      { label: 'Company', value: 'company' },
      { label: 'LLP', value: 'llp' },
      { label: 'Partnership firm', value: 'partnership' },
      { label: 'Sole proprietorship', value: 'proprietorship' },
      { label: 'HUF', value: 'huf' },
      { label: 'Trust', value: 'trust' },
      { label: 'Society', value: 'society' },
      { label: 'Other', value: 'other' },
    ]),
  },
  {
    key: 'employment_type',
    name: 'Employment type',
    description: 'Nature of employment',
    values: toValues([
      { label: 'Full-time', value: 'full_time' },
      { label: 'Part-time', value: 'part_time' },
      { label: 'Contract', value: 'contract' },
      { label: 'Internship', value: 'internship' },
    ]),
  },
  {
    key: 'pay_frequency',
    name: 'Pay frequency',
    description: 'How compensation is quoted/paid',
    values: toValues([
      { label: 'Monthly', value: 'monthly' },
      { label: 'Annually', value: 'annual' },
    ]),
  },
  {
    key: 'dispute_resolution',
    name: 'Dispute resolution',
    description: 'Forum for disputes',
    values: toValues([
      { label: 'Courts', value: 'courts' },
      { label: 'Arbitration', value: 'arbitration' },
    ]),
  },
  {
    key: 'invoice_tax_mode',
    name: 'Invoice tax mode',
    description: 'GST / single tax / none',
    values: toValues([
      { label: 'GST (India — CGST/SGST/IGST)', value: 'gst' },
      { label: 'Single tax (VAT / sales tax)', value: 'single' },
      { label: 'No tax', value: 'none' },
    ]),
  },
  {
    key: 'rent_property_type',
    name: 'Property type',
    description: 'Type of premises let',
    values: toValues([
      { label: 'Apartment / Flat', value: 'apartment' },
      { label: 'Independent house', value: 'independent_house' },
      { label: 'Villa', value: 'villa' },
      { label: 'Commercial', value: 'commercial' },
      { label: 'PG room', value: 'pg_room' },
    ]),
  },
  {
    key: 'rent_furnishing',
    name: 'Furnishing',
    description: 'Furnishing status of premises',
    values: toValues([
      { label: 'Unfurnished', value: 'unfurnished' },
      { label: 'Semi-furnished', value: 'semi_furnished' },
      { label: 'Fully furnished', value: 'fully_furnished' },
    ]),
  },
  {
    key: 'affidavit_id_type',
    name: 'ID type',
    description: 'Identity document type',
    values: toValues([
      { label: 'None', value: 'none' },
      { label: 'Aadhaar', value: 'aadhaar' },
      { label: 'PAN', value: 'pan' },
      { label: 'Passport', value: 'passport' },
      { label: 'Voter ID', value: 'voter_id' },
      { label: 'Driving Licence', value: 'driving_licence' },
    ]),
  },
  {
    key: 'affidavit_attestation',
    name: 'Attestation',
    description: 'Who attests the affidavit',
    values: toValues([
      { label: 'Notary Public', value: 'notary' },
      { label: 'Oath Commissioner', value: 'oath_commissioner' },
      { label: 'Executive Magistrate', value: 'executive_magistrate' },
      { label: 'Self-attested', value: 'self_attested' },
    ]),
  },
  {
    key: 'notice_type',
    name: 'Legal notice type',
    description: 'Statutory framing of a legal notice',
    values: toValues([
      { label: 'Cheque bounce (NI Act §138)', value: 'cheque_bounce' },
      { label: 'Consumer (CPA 2019)', value: 'consumer' },
      { label: 'Civil recovery of money', value: 'civil_recovery' },
      { label: 'Employment', value: 'employment' },
      { label: 'General', value: 'general' },
    ]),
  },
  {
    key: 'notice_delivery_mode',
    name: 'Mode of service',
    description: 'How a notice/document is served',
    values: toValues([
      { label: 'Registered post (A/D)', value: 'registered_post_ad' },
      { label: 'Email', value: 'email' },
      { label: 'Courier', value: 'courier' },
      { label: 'By hand', value: 'hand' },
    ]),
  },
  {
    key: 'poa_type',
    name: 'Power of attorney type',
    description: 'General or special PoA',
    values: toValues([
      { label: 'Special (specific acts)', value: 'special' },
      { label: 'General (broad powers)', value: 'general' },
    ]),
  },
  {
    key: 'duration_type',
    name: 'Duration type',
    description: 'Until revoked or until a fixed date',
    values: toValues([
      { label: 'Until revoked', value: 'until_revoked' },
      { label: 'Until a fixed date', value: 'fixed' },
    ]),
  },
  {
    key: 'payable_on',
    name: 'Payable on',
    description: 'On demand or on a fixed date',
    values: toValues([
      { label: 'On demand', value: 'demand' },
      { label: 'On a fixed date', value: 'fixed_date' },
    ]),
  },
  {
    key: 'rti_info_format',
    name: 'RTI information format',
    description: 'Form in which RTI information is sought',
    values: toValues([
      { label: 'Certified copies', value: 'certified_copies' },
      { label: 'Inspection of records', value: 'inspection' },
      { label: 'Soft copy (CD / email)', value: 'soft_copy' },
      { label: 'Samples of material', value: 'sample' },
    ]),
  },
  {
    key: 'rti_fee_mode',
    name: 'RTI fee mode',
    description: 'How the RTI fee is paid',
    values: toValues([
      { label: 'Indian Postal Order', value: 'ipo' },
      { label: 'Demand Draft', value: 'dd' },
      { label: 'Court-fee stamp', value: 'court_fee_stamp' },
      { label: 'Cash', value: 'cash' },
      { label: 'Online payment', value: 'online' },
    ]),
  },
  {
    key: 'in_states',
    name: 'Indian States & UTs',
    description: 'States and Union Territories with ISO 3166-2:IN codes',
    // Built literally (NOT via toValues, which lowercases) because the value
    // must stay an uppercase ISO code — the consuming fields validate against
    // /^IN-[A-Z]{2}$/ (rent property.state, RTI authority.state).
    values: (
      [
        ['Andhra Pradesh', 'IN-AP'],
        ['Arunachal Pradesh', 'IN-AR'],
        ['Assam', 'IN-AS'],
        ['Bihar', 'IN-BR'],
        ['Chhattisgarh', 'IN-CT'],
        ['Goa', 'IN-GA'],
        ['Gujarat', 'IN-GJ'],
        ['Haryana', 'IN-HR'],
        ['Himachal Pradesh', 'IN-HP'],
        ['Jharkhand', 'IN-JH'],
        ['Karnataka', 'IN-KA'],
        ['Kerala', 'IN-KL'],
        ['Madhya Pradesh', 'IN-MP'],
        ['Maharashtra', 'IN-MH'],
        ['Manipur', 'IN-MN'],
        ['Meghalaya', 'IN-ML'],
        ['Mizoram', 'IN-MZ'],
        ['Nagaland', 'IN-NL'],
        ['Odisha', 'IN-OR'],
        ['Punjab', 'IN-PB'],
        ['Rajasthan', 'IN-RJ'],
        ['Sikkim', 'IN-SK'],
        ['Tamil Nadu', 'IN-TN'],
        ['Telangana', 'IN-TG'],
        ['Tripura', 'IN-TR'],
        ['Uttar Pradesh', 'IN-UP'],
        ['Uttarakhand', 'IN-UT'],
        ['West Bengal', 'IN-WB'],
        ['Andaman & Nicobar Islands', 'IN-AN'],
        ['Chandigarh', 'IN-CH'],
        ['Dadra & Nagar Haveli and Daman & Diu', 'IN-DH'],
        ['Delhi', 'IN-DL'],
        ['Jammu & Kashmir', 'IN-JK'],
        ['Ladakh', 'IN-LA'],
        ['Lakshadweep', 'IN-LD'],
        ['Puducherry', 'IN-PY'],
      ] as Array<[string, string]>
    ).map(([label, value], i) => ({ label, value, order: i })),
  },
];
