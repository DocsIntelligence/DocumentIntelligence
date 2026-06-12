import type { FormMetadata } from '../types';

const personFields = (
  prefix: 'principal' | 'attorney',
  who: string,
): FormMetadata => ({
  [`${prefix}.name`]: { label: `${who} — name` },
  [`${prefix}.parentRelation`]: {
    label: `${who} — relation`,
    widget: 'lookup',
    lookupKey: 'party_relation',
  },
  [`${prefix}.parentName`]: { label: `${who} — father/husband's name` },
  [`${prefix}.address`]: { label: `${who} — address`, widget: 'textarea' },
  [`${prefix}.occupation`]: { label: `${who} — occupation` },
});

export const powerOfAttorneyFormMetadata: FormMetadata = {
  // Meta
  'poa.type': {
    label: 'Type',
    widget: 'lookup',
    lookupKey: 'poa_type',
    helperText: 'A Special PoA is limited to the listed acts; a General PoA is broad.',
  },
  'poa.executionDate': { label: 'Date of execution', widget: 'date' },
  'poa.place': { label: 'Place', placeholder: 'Mumbai' },
  'poa.registered': {
    label: 'Will this be registered?',
    helperText: 'A PoA dealing with immovable property generally must be registered.',
  },

  // Principal & attorney
  ...personFields('principal', 'Principal (Grantor)'),
  ...personFields('attorney', 'Attorney (Agent)'),
  'attorney.relationship': {
    label: 'Attorney — relationship to principal',
    placeholder: 'e.g. brother, friend, advocate',
  },

  // Powers
  powers: {
    label: 'Powers granted',
    widget: 'list',
    helperText: 'One power/authority per line, as specifically as possible.',
    aiPromptKey: 'poa.tighten_powers',
  },

  // Terms
  'terms.purpose': {
    label: 'Purpose / context (optional)',
    widget: 'textarea',
  },
  'terms.durationType': {
    label: 'Duration',
    widget: 'lookup',
    lookupKey: 'duration_type',
  },
  'terms.expiryDate': {
    label: 'Valid until',
    widget: 'date',
    showIf: { field: 'terms.durationType', equals: 'fixed' },
  },

  // Witnesses
  witnesses: {
    label: 'Witnesses',
    widget: 'group',
    itemLabel: 'Witness',
    maxItems: 3,
    itemFields: {
      name: { label: 'Name' },
      address: { label: 'Address', widget: 'textarea' },
    },
  },
};

export const powerOfAttorneySectionOrder = [
  'poa',
  'principal',
  'attorney',
  'powers',
  'terms',
  'witnesses',
];
