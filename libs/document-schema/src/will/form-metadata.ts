import type { FormMetadata } from '../types';

export const willFormMetadata: FormMetadata = {
  // Will meta
  'will.place': { label: 'Place of execution', placeholder: 'Mumbai' },
  'will.date': { label: 'Date', widget: 'date' },
  'will.revokesPriorWills': {
    label: 'Revoke all earlier wills and codicils?',
  },
  'will.soundMind': {
    label: 'Declare sound mind & free will?',
  },

  // Testator
  'testator.name': { label: 'Testator — full name' },
  'testator.relation': {
    label: 'Relation',
    widget: 'lookup',
    lookupKey: 'party_relation',
  },
  'testator.parentName': { label: 'Father / husband name' },
  'testator.age': { label: 'Age', widget: 'number' },
  'testator.occupation': { label: 'Occupation' },
  'testator.address': { label: 'Address', widget: 'textarea' },

  // Executor
  'executor.name': { label: 'Executor — name' },
  'executor.relationship': {
    label: 'Relationship to testator',
    placeholder: 'spouse / son / friend',
  },
  'executor.address': { label: 'Executor address', widget: 'textarea' },
  'executor.alternateName': { label: 'Alternate executor (optional)' },
  'executor.alternateAddress': {
    label: 'Alternate executor address',
    widget: 'textarea',
  },

  // Bequests
  bequests: {
    label: 'Bequests',
    widget: 'group',
    itemLabel: 'Bequest',
    maxItems: 50,
    itemFields: {
      beneficiary: { label: 'Beneficiary name' },
      relationship: { label: 'Relationship', placeholder: 'son / daughter' },
      description: {
        label: 'What is bequeathed',
        widget: 'textarea',
        placeholder:
          'e.g. my flat at 12 MG Road, Pune / my savings account no. … / 100 shares of …',
      },
    },
  },

  // Wishes
  'wishes.residuaryBeneficiary': {
    label: 'Residue of estate goes to',
    helperText: 'Whoever receives anything not specifically bequeathed above.',
  },
  'wishes.guardianName': { label: 'Guardian for minor children (optional)' },
  'wishes.guardianForMinors': {
    label: 'Names of minor children',
    placeholder: 'comma-separated',
  },
  'wishes.funeralWishes': { label: 'Funeral / last wishes (optional)', widget: 'textarea' },

  // Witnesses
  witnesses: {
    label: 'Witnesses (two required)',
    widget: 'group',
    itemLabel: 'Witness',
    maxItems: 4,
    itemFields: {
      name: { label: 'Witness name' },
      address: { label: 'Witness address', widget: 'textarea' },
    },
  },
};

export const willSectionOrder = [
  'will',
  'testator',
  'executor',
  'bequests',
  'wishes',
  'witnesses',
];
