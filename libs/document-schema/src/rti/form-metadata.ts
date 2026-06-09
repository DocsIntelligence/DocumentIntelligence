import type { FieldOption, FormMetadata } from '../types';

const PARENT_RELATION: FieldOption[] = [
  { value: 'S/o', label: 'Son of (S/o)' },
  { value: 'D/o', label: 'Daughter of (D/o)' },
  { value: 'W/o', label: 'Wife of (W/o)' },
];

export const rtiFormMetadata: FormMetadata = {
  place: { label: 'Place', placeholder: 'New Delhi' },
  applicationDate: { label: 'Date of application', widget: 'date' },

  // Applicant
  'applicant.name': { label: 'Applicant — full name' },
  'applicant.parentRelation': {
    label: 'Relation',
    widget: 'select',
    options: PARENT_RELATION,
  },
  'applicant.parentName': { label: "Father/Husband/Mother's name" },
  'applicant.address': { label: 'Address for reply', widget: 'address' },
  'applicant.phone': { label: 'Phone', widget: 'phone' },
  'applicant.email': { label: 'Email' },
  'applicant.isBPL': {
    label: 'Below Poverty Line (BPL)?',
    helperText:
      'BPL applicants pay no fee (proviso to §7(5) RTI Act). Attach the BPL certificate.',
  },

  // Authority
  'authority.publicAuthority': {
    label: 'Public authority',
    helperText: 'The department/office that holds the information.',
  },
  'authority.department': { label: 'Department / wing' },
  'authority.officeAddress': { label: 'Office address', widget: 'textarea' },
  'authority.state': {
    label: 'State',
    widget: 'lookup',
    lookupKey: 'in_states',
  },

  // PIO
  'pio.name': { label: 'PIO name (if known)' },
  'pio.designation': { label: 'PIO designation (if known)' },

  // Request
  'request.subject': {
    label: 'Subject of the information',
    placeholder: 'e.g. Status of building plan approval no. …',
  },
  'request.questions': {
    label: 'Information sought',
    widget: 'list',
    helperText:
      'One specific point per line. Ask for information, not opinions.',
    aiPromptKey: 'rti.frame_questions',
  },
  'request.periodFrom': { label: 'Period from', widget: 'date' },
  'request.periodTo': { label: 'Period to', widget: 'date' },
  'request.preferredFormat': {
    label: 'Preferred format',
    widget: 'select',
    options: [
      { value: 'certified_copies', label: 'Certified copies' },
      { value: 'inspection', label: 'Inspection of records' },
      { value: 'soft_copy', label: 'Soft copy (CD / email)' },
      { value: 'sample', label: 'Samples of material' },
    ],
  },
  'request.lifeOrLiberty': {
    label: 'Concerns life or liberty?',
    helperText:
      'If yes, information must be provided within 48 hours (proviso to §7(1)).',
  },

  // Fee
  'fee.amount': { label: 'Application fee (₹)', widget: 'currency' },
  'fee.mode': {
    label: 'Fee mode',
    widget: 'select',
    options: [
      { value: 'ipo', label: 'Indian Postal Order' },
      { value: 'dd', label: 'Demand Draft' },
      { value: 'court_fee_stamp', label: 'Court-fee stamp' },
      { value: 'cash', label: 'Cash' },
      { value: 'online', label: 'Online payment' },
    ],
  },
  'fee.paid': { label: 'Fee enclosed/paid' },
};

export const rtiSectionOrder = [
  'applicant',
  'authority',
  'pio',
  'request',
  'fee',
];
