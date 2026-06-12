import type { FormMetadata } from '../types';

const ENTITY_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
  { value: 'llp', label: 'LLP' },
  { value: 'partnership', label: 'Partnership firm' },
  { value: 'proprietorship', label: 'Sole proprietorship' },
  { value: 'huf', label: 'HUF' },
  { value: 'trust', label: 'Trust' },
  { value: 'society', label: 'Society' },
  { value: 'other', label: 'Other' },
];

const partyFields = (prefix: 'partyA' | 'partyB', who: string): FormMetadata => ({
  [`${prefix}.name`]: { label: `${who} — name`, placeholder: 'Full legal name' },
  [`${prefix}.entityType`]: {
    label: `${who} — type`,
    widget: 'select',
    options: ENTITY_OPTIONS,
  },
  [`${prefix}.address`]: { label: `${who} — address`, widget: 'textarea' },
  [`${prefix}.repName`]: {
    label: `${who} — authorised signatory`,
    helperText: 'Person signing on behalf of a company/firm (leave blank for an individual).',
    showIf: { field: `${prefix}.entityType`, in: ['company', 'llp', 'partnership', 'proprietorship', 'huf', 'trust', 'society', 'other'] },
  },
  [`${prefix}.repDesignation`]: {
    label: `${who} — signatory designation`,
    placeholder: 'e.g. Director / Authorised Signatory',
    showIf: { field: `${prefix}.entityType`, in: ['company', 'llp', 'partnership', 'proprietorship', 'huf', 'trust', 'society', 'other'] },
  },
  [`${prefix}.email`]: { label: `${who} — email` },
});

export const ndaFormMetadata: FormMetadata = {
  // Agreement
  'agreement.mutual': {
    label: 'Mutual (both parties disclose)?',
    helperText:
      'If off, Party A is the Disclosing Party and Party B the Receiving Party (one-way).',
  },
  'agreement.effectiveDate': { label: 'Effective date', widget: 'date' },
  'agreement.place': { label: 'Place of execution', placeholder: 'Bengaluru' },
  'agreement.purpose': {
    label: 'Purpose',
    widget: 'textarea',
    helperText: 'The permitted purpose for which information is shared.',
    placeholder: 'e.g. evaluating a potential business relationship regarding …',
    aiPromptKey: 'nda.tighten_purpose',
  },

  // Parties
  ...partyFields('partyA', 'Party A'),
  ...partyFields('partyB', 'Party B'),

  // Terms
  'terms.confidentialScope': {
    label: 'What is Confidential Information?',
    widget: 'list',
    helperText: 'One category per line (e.g. business plans, source code, pricing).',
    aiPromptKey: 'nda.suggest_scope',
  },
  'terms.customExclusions': {
    label: 'Additional exclusions (optional)',
    widget: 'list',
    helperText:
      'Standard carve-outs (public, already known, independently developed, lawfully received) are included automatically.',
  },
  'terms.termMonths': {
    label: 'Agreement term (months)',
    widget: 'number',
  },
  'terms.survivalYears': {
    label: 'Confidentiality survives (years)',
    widget: 'number',
    helperText: '0 = obligations continue indefinitely.',
  },
  'terms.permitDisclosureToReps': {
    label: 'Allow sharing with employees/advisors on a need-to-know basis?',
  },
  'terms.returnOrDestroy': {
    label: 'Require return/destruction of materials on termination?',
  },
  'terms.injunctiveRelief': {
    label: 'Include injunctive-relief clause?',
    helperText: 'Acknowledges that damages alone may be inadequate for a breach.',
  },

  // Governing
  'governing.state': { label: 'Governing law — State', placeholder: 'Karnataka' },
  'governing.jurisdictionCity': {
    label: 'Exclusive jurisdiction — city',
    placeholder: 'Bengaluru',
  },
  'governing.disputeResolution': {
    label: 'Dispute resolution',
    widget: 'select',
    options: [
      { value: 'courts', label: 'Courts' },
      { value: 'arbitration', label: 'Arbitration' },
    ],
  },
  'governing.arbitrationSeat': {
    label: 'Arbitration seat',
    placeholder: 'Bengaluru',
    showIf: { field: 'governing.disputeResolution', equals: 'arbitration' },
  },

  // Witnesses
  witnesses: {
    label: 'Witnesses (optional)',
    widget: 'group',
    itemLabel: 'Witness',
    maxItems: 4,
    itemFields: {
      name: { label: 'Name' },
      address: { label: 'Address', widget: 'textarea' },
    },
  },
};

export const ndaSectionOrder = [
  'agreement',
  'partyA',
  'partyB',
  'terms',
  'governing',
  'witnesses',
];
