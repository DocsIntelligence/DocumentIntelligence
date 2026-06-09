import type { FormMetadata } from '../types';

export const affidavitFormMetadata: FormMetadata = {
  place: { label: 'Place', placeholder: 'New Delhi' },
  affidavitDate: { label: 'Date of affidavit', widget: 'date' },

  // Deponent
  'deponent.name': { label: 'Deponent — full name' },
  'deponent.parentRelation': {
    label: 'Relation',
    widget: 'select',
    helperText: 'S/o, D/o or W/o.',
    options: [
      { value: 'S/o', label: 'Son of (S/o)' },
      { value: 'D/o', label: 'Daughter of (D/o)' },
      { value: 'W/o', label: 'Wife of (W/o)' },
    ],
  },
  'deponent.parentName': { label: "Father/Husband/Mother's name" },
  'deponent.age': { label: 'Age (years)', widget: 'number' },
  'deponent.occupation': { label: 'Occupation', placeholder: 'e.g. Service' },
  'deponent.address': { label: 'Residential address', widget: 'address' },
  'deponent.idType': {
    label: 'ID proof type',
    widget: 'select',
    helperText: 'Aadhaar / PAN / Passport / Voter ID / Driving Licence.',
    options: [
      { value: 'none', label: 'None' },
      { value: 'aadhaar', label: 'Aadhaar' },
      { value: 'pan', label: 'PAN' },
      { value: 'passport', label: 'Passport' },
      { value: 'voter_id', label: 'Voter ID' },
      { value: 'driving_licence', label: 'Driving Licence' },
    ],
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
    widget: 'select',
    helperText:
      'Notary / Oath Commissioner / Executive Magistrate. Self-attested declarations may not be accepted where an affidavit is required.',
    options: [
      { value: 'notary', label: 'Notary Public' },
      { value: 'oath_commissioner', label: 'Oath Commissioner' },
      { value: 'executive_magistrate', label: 'Executive Magistrate' },
      { value: 'self_attested', label: 'Self-attested' },
    ],
  },
};

export const affidavitSectionOrder = [
  'deponent',
  'declaration',
  'attestation',
];
