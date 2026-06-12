import type { FormMetadata } from '../types';

const partyFields = (
  prefix: 'maker' | 'payee',
  who: string,
): FormMetadata => ({
  [`${prefix}.name`]: { label: `${who} — name`, placeholder: 'Full name' },
  [`${prefix}.parentRelation`]: {
    label: `${who} — relation`,
    widget: 'lookup',
    lookupKey: 'party_relation',
  },
  [`${prefix}.parentName`]: {
    label: `${who} — father/husband's name`,
  },
  [`${prefix}.address`]: { label: `${who} — address`, widget: 'textarea' },
});

export const promissoryNoteFormMetadata: FormMetadata = {
  // Note details
  'note.place': { label: 'Place of execution', placeholder: 'Chennai' },
  'note.noteDate': { label: 'Date', widget: 'date' },
  'note.principalAmount': {
    label: 'Principal amount (₹)',
    widget: 'currency',
  },
  'note.interestRate': {
    label: 'Interest rate (% per annum)',
    widget: 'number',
    helperText: 'Leave blank or 0 for an interest-free note.',
  },
  'note.payableOn': {
    label: 'Payable',
    widget: 'lookup',
    lookupKey: 'payable_on',
  },
  'note.dueDate': {
    label: 'Due date',
    widget: 'date',
    showIf: { field: 'note.payableOn', equals: 'fixed_date' },
  },
  'note.consideration': {
    label: 'Consideration received for',
    placeholder: 'e.g. a hand loan / goods supplied',
    helperText: 'A promissory note must be supported by consideration ("for value received").',
  },
  'note.onStampPaper': {
    label: 'Executed on stamp paper / with revenue stamp?',
    helperText:
      'A promissory note must bear the requisite stamp (Indian Stamp Act) or it is inadmissible in evidence.',
  },

  // Parties
  ...partyFields('maker', 'Maker (Promisor)'),
  ...partyFields('payee', 'Payee'),

  // Witnesses
  witnesses: {
    label: 'Witnesses (optional)',
    widget: 'group',
    itemLabel: 'Witness',
    maxItems: 2,
    itemFields: {
      name: { label: 'Name' },
      address: { label: 'Address', widget: 'textarea' },
    },
  },
};

export const promissoryNoteSectionOrder = [
  'note',
  'maker',
  'payee',
  'witnesses',
];
