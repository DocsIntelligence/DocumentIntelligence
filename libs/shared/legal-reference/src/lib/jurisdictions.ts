/**
 * Indian jurisdictions used across document schemas and templates. Codes follow
 * the `IN-<ISO 3166-2 suffix>` convention already used in the document-schema
 * registry (e.g. `IN-MH`). `IN-*` means "all India / not state-specific".
 */

export const IN_ALL = 'IN-*' as const;

export interface Jurisdiction {
  code: string; // e.g. "IN-MH"
  name: string; // e.g. "Maharashtra"
  type: 'state' | 'ut' | 'all';
}

export const JURISDICTIONS: Jurisdiction[] = [
  { code: IN_ALL, name: 'All India', type: 'all' },
  // States
  { code: 'IN-AP', name: 'Andhra Pradesh', type: 'state' },
  { code: 'IN-AR', name: 'Arunachal Pradesh', type: 'state' },
  { code: 'IN-AS', name: 'Assam', type: 'state' },
  { code: 'IN-BR', name: 'Bihar', type: 'state' },
  { code: 'IN-CT', name: 'Chhattisgarh', type: 'state' },
  { code: 'IN-GA', name: 'Goa', type: 'state' },
  { code: 'IN-GJ', name: 'Gujarat', type: 'state' },
  { code: 'IN-HR', name: 'Haryana', type: 'state' },
  { code: 'IN-HP', name: 'Himachal Pradesh', type: 'state' },
  { code: 'IN-JH', name: 'Jharkhand', type: 'state' },
  { code: 'IN-KA', name: 'Karnataka', type: 'state' },
  { code: 'IN-KL', name: 'Kerala', type: 'state' },
  { code: 'IN-MP', name: 'Madhya Pradesh', type: 'state' },
  { code: 'IN-MH', name: 'Maharashtra', type: 'state' },
  { code: 'IN-MN', name: 'Manipur', type: 'state' },
  { code: 'IN-ML', name: 'Meghalaya', type: 'state' },
  { code: 'IN-MZ', name: 'Mizoram', type: 'state' },
  { code: 'IN-NL', name: 'Nagaland', type: 'state' },
  { code: 'IN-OR', name: 'Odisha', type: 'state' },
  { code: 'IN-PB', name: 'Punjab', type: 'state' },
  { code: 'IN-RJ', name: 'Rajasthan', type: 'state' },
  { code: 'IN-SK', name: 'Sikkim', type: 'state' },
  { code: 'IN-TN', name: 'Tamil Nadu', type: 'state' },
  { code: 'IN-TG', name: 'Telangana', type: 'state' },
  { code: 'IN-TR', name: 'Tripura', type: 'state' },
  { code: 'IN-UP', name: 'Uttar Pradesh', type: 'state' },
  { code: 'IN-UT', name: 'Uttarakhand', type: 'state' },
  { code: 'IN-WB', name: 'West Bengal', type: 'state' },
  // Union Territories
  { code: 'IN-AN', name: 'Andaman & Nicobar Islands', type: 'ut' },
  { code: 'IN-CH', name: 'Chandigarh', type: 'ut' },
  { code: 'IN-DH', name: 'Dadra & Nagar Haveli and Daman & Diu', type: 'ut' },
  { code: 'IN-DL', name: 'Delhi (NCT)', type: 'ut' },
  { code: 'IN-JK', name: 'Jammu & Kashmir', type: 'ut' },
  { code: 'IN-LA', name: 'Ladakh', type: 'ut' },
  { code: 'IN-LD', name: 'Lakshadweep', type: 'ut' },
  { code: 'IN-PY', name: 'Puducherry', type: 'ut' },
];

const BY_CODE = new Map(JURISDICTIONS.map((j) => [j.code, j]));

export function getJurisdiction(code: string): Jurisdiction | undefined {
  return BY_CODE.get(code);
}

export function jurisdictionName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}
