import type { FormMetadata } from '../types';

export const affidavitFormMetadata: FormMetadata = {
  place: { label: 'Place', placeholder: 'New Delhi' },
  affidavitDate: { label: 'Date of affidavit', widget: 'date' },

  // Deponent
  'deponent.name': { label: 'Deponent — full name' },
  'deponent.parentRelation': {
    label: 'Relation',
    widget: 'lookup',
    lookupKey: 'party_relation',
    helperText: 'S/o, D/o, W/o or C/o.',
  },
  'deponent.parentName': { label: "Father/Husband/Mother's name" },
  'deponent.age': { label: 'Age (years)', widget: 'number' },
  'deponent.occupation': { label: 'Occupation', placeholder: 'e.g. Service' },
  'deponent.address': { label: 'Residential address', widget: 'address' },
  'deponent.idType': {
    label: 'ID proof type',
    widget: 'lookup',
    lookupKey: 'affidavit_id_type',
    helperText: 'Aadhaar / PAN / Passport / Voter ID / Driving Licence.',
  },
  'deponent.idNumber': { label: 'ID number' },

  // Declaration
  'declaration.title': {
    label: 'Affidavit title',
    placeholder: 'e.g. Affidavit for Change of Name',
    helperText: 'Optional. Defaults to "AFFIDAVIT".',
  },
  'declaration.purpose': {
    label: 'Purpose',
    placeholder: 'e.g. submission to the Regional Passport Office, New Delhi',
  },
  'declaration.statements': {
    label: 'Statements / declarations',
    widget: 'list',
    helperText: 'One declaration per line, in the first person ("I …").',
    aiPromptKey: 'affidavit.frame_statements',
  },

  // Attestation
  'attestation.type': {
    label: 'Sworn before',
    widget: 'lookup',
    lookupKey: 'affidavit_attestation',
    helperText:
      'Notary / Oath Commissioner / Executive Magistrate. Self-attested declarations may not be accepted where an affidavit is required.',
  },
};

export const affidavitSectionOrder = [
  'deponent',
  'declaration',
  'attestation',
];
