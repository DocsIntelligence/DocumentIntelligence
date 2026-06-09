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
    description: 'Supported currencies',
    values: toValues([
      { label: 'USD ($)', value: 'USD' },
      { label: 'EUR (€)', value: 'EUR' },
      { label: 'INR (₹)', value: 'INR' },
      { label: 'GBP (£)', value: 'GBP' },
      { label: 'CAD (C$)', value: 'CAD' },
      { label: 'AUD (A$)', value: 'AUD' },
    ]),
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
