/**
 * Schedule 1 of the Information Technology Act, 2000 lists documents that
 * **cannot** be validly executed by electronic signature. They must be signed
 * on paper by hand. eSign must be hard-gated off for these; for now we surface
 * a warning (eSign provider integration is deferred).
 *
 * Source: IT Act 2000, First Schedule (as amended).
 */

export interface Schedule1Exclusion {
  id: string;
  label: string;
  note: string;
}

export const SCHEDULE_1_EXCLUSIONS: Schedule1Exclusion[] = [
  {
    id: 'negotiable_instrument',
    label: 'Negotiable instrument (other than a cheque)',
    note: 'Promissory notes, bills of exchange, etc. — under the Negotiable Instruments Act, 1881.',
  },
  {
    id: 'power_of_attorney',
    label: 'Power of Attorney',
    note: 'Under the Powers-of-Attorney Act, 1882.',
  },
  {
    id: 'trust',
    label: 'Trust deed',
    note: 'Under the Indian Trusts Act, 1882.',
  },
  {
    id: 'will',
    label: 'Will / testamentary disposition',
    note: 'Including any testamentary disposition by whatever name called, under the Indian Succession Act, 1925.',
  },
  {
    id: 'immovable_property',
    label: 'Sale or conveyance of immovable property',
    note: 'Any contract for the sale or conveyance of immovable property or any interest in such property.',
  },
];

/**
 * Document-type / preset keys that fall under a Schedule-1 exclusion (kept
 * conservative — when in doubt we warn). Used to gate eSign and show a notice.
 */
export const ESIGN_EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  'will',
  'gpa', // general power of attorney
  'power-of-attorney',
  'power_of_attorney',
  'gift-deed', // gift of immovable property is a conveyance
  'sale-deed',
  'sale-agreement',
  'sale_deed',
  'trust-deed',
  'trust_deed',
  'promissory-note',
]);

/** Is this doc-type/preset key excluded from valid eSignature under Schedule 1? */
export function isESignExcluded(key?: string | null): boolean {
  return !!key && ESIGN_EXCLUDED_KEYS.has(key);
}

export const SCHEDULE_1_NOTE =
  'Under Schedule 1 of the IT Act, 2000, this document type cannot be validly signed electronically (wills, powers of attorney, trusts, negotiable instruments other than cheques, and conveyances of immovable property). Print it and sign by hand.';
