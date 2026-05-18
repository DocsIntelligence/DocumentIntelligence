/**
 * Human labels for the top-level sections of each document type. Kept
 * separate from form-metadata (which is field-grained) because section
 * headings deserve a small amount of curation.
 */

export const sectionLabels: Record<string, string> = {
  state: 'Jurisdiction',
  'parties.landlord': 'Landlord',
  'parties.tenant': 'Tenant',
  property: 'Premises',
  term: 'Term',
  rent_deposit: 'Rent & Deposit',
  utilities: 'Utilities',
  rules: 'House Rules',
  witnesses: 'Witnesses',
};

export function labelFor(sectionKey: string): string {
  if (sectionLabels[sectionKey]) return sectionLabels[sectionKey];
  const segments = sectionKey.split('.');
  const last = segments[segments.length - 1] ?? sectionKey;
  return last
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}
