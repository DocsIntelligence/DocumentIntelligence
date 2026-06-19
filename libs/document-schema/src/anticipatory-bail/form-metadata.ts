import type { FormMetadata } from '../types';

export const anticipatoryBailFormMetadata: FormMetadata = {
  applicationDate: { label: 'Date of application', widget: 'date' },
  place: { label: 'Place', placeholder: 'Pune' },
  court: {
    label: 'Court',
    widget: 'select',
    options: [
      { value: 'sessions', label: 'Court of Session' },
      { value: 'high_court', label: 'High Court' },
    ],
    helperText:
      'Anticipatory bail (§482 BNSS) lies only before the Court of Session or the High Court.',
  },
  courtName: {
    label: 'Full name of the court',
    placeholder: 'Court of Session, Pune',
  },
  state: { label: 'State (respondent)', placeholder: 'Maharashtra' },

  // Applicant (proposed accused)
  'applicant.name': { label: 'Applicant — name' },
  'applicant.guardianName': {
    label: 'S/o · D/o · W/o',
    placeholder: 'father / husband name',
  },
  'applicant.age': { label: 'Age', widget: 'number' },
  'applicant.occupation': { label: 'Occupation' },
  'applicant.address': { label: 'Address', widget: 'textarea' },
  'applicant.phone': { label: 'Phone', widget: 'phone' },

  // FIR
  'fir.number': {
    label: 'FIR no. (if registered)',
    helperText:
      'Anticipatory bail can be sought even before an FIR is registered, on a reasonable apprehension of arrest.',
  },
  'fir.date': { label: 'FIR date', widget: 'date' },
  'fir.policeStation': { label: 'Police station' },
  'fir.district': { label: 'District' },

  // Offences
  offences: {
    label: 'Offences alleged (from the FIR)',
    widget: 'list',
    helperText:
      'Copy the sections exactly as alleged in the FIR (e.g. "BNS §318(4)"). One per line.',
  },
  offenceIsNonBailable: {
    label: 'Alleged offence is non-bailable?',
    helperText:
      'Anticipatory bail is for apprehension of arrest in non-bailable offences.',
  },

  // Apprehension + grounds
  apprehensionGrounds: {
    label: 'Why you apprehend arrest',
    widget: 'textarea',
    helperText:
      'The reasonable apprehension of arrest — the foundation of a §482 application.',
    aiPromptKey: 'bail.describe_apprehension',
  },
  groundsForBail: {
    label: 'Grounds for anticipatory bail',
    widget: 'list',
    helperText:
      'e.g. false implication, no antecedents, deep roots in society, willing to cooperate, no custodial interrogation needed.',
    aiPromptKey: 'bail.suggest_grounds',
  },

  cleanAntecedents: { label: 'No prior criminal antecedents?' },
  willingToCooperate: { label: 'Undertakes to cooperate with investigation?' },
  custodyNotRequired: { label: 'Custodial interrogation not required?' },

  proposedConditions: {
    label: 'Conditions you offer to abide by (optional)',
    widget: 'list',
    helperText:
      'e.g. appear when called, not tamper with evidence, not leave the country without leave (§482(2)).',
  },

  // Advocate (optional)
  'advocate.name': { label: 'Advocate — name' },
  'advocate.enrollmentNo': { label: 'Bar enrolment no.' },
  'advocate.address': { label: 'Advocate office address', widget: 'textarea' },
  'advocate.phone': { label: 'Advocate phone', widget: 'phone' },
};

export const anticipatoryBailSectionOrder = [
  'applicationDate',
  'applicant',
  'fir',
  'offences',
  'apprehensionGrounds',
  'groundsForBail',
  'proposedConditions',
  'advocate',
];
