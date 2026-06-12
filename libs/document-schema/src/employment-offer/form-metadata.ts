import type { FormMetadata } from '../types';

export const employmentOfferFormMetadata: FormMetadata = {
  // Offer meta
  'offer.letterDate': { label: 'Letter date', widget: 'date' },
  'offer.place': { label: 'Place', placeholder: 'Bengaluru' },

  // Company
  'company.name': { label: 'Company name' },
  'company.address': { label: 'Company address', widget: 'textarea' },
  'company.signatoryName': { label: 'Signed by — name' },
  'company.signatoryDesignation': {
    label: 'Signed by — designation',
    placeholder: 'e.g. Head of People',
  },

  // Candidate
  'candidate.name': { label: 'Candidate name' },
  'candidate.address': { label: 'Candidate address', widget: 'textarea' },
  'candidate.email': { label: 'Candidate email' },

  // Role
  'role.title': { label: 'Job title', placeholder: 'Senior Software Engineer' },
  'role.department': { label: 'Department' },
  'role.reportingTo': { label: 'Reporting to' },
  'role.location': { label: 'Work location' },
  'role.employmentType': {
    label: 'Employment type',
    widget: 'select',
    options: [
      { value: 'full_time', label: 'Full-time' },
      { value: 'part_time', label: 'Part-time' },
      { value: 'contract', label: 'Contract' },
      { value: 'internship', label: 'Internship' },
    ],
  },
  'role.startDate': { label: 'Start date', widget: 'date' },
  'role.probationMonths': { label: 'Probation (months)', widget: 'number' },

  // Compensation
  'compensation.currency': {
    label: 'Currency',
    widget: 'select',
    options: [
      { value: 'INR', label: '₹ INR' },
      { value: 'USD', label: '$ USD' },
      { value: 'EUR', label: '€ EUR' },
      { value: 'GBP', label: '£ GBP' },
      { value: 'AED', label: 'AED' },
      { value: 'SGD', label: 'S$ SGD' },
    ],
  },
  'compensation.annualCtc': {
    label: 'Total annual compensation / CTC',
    widget: 'number',
  },
  'compensation.payFrequency': {
    label: 'Paid',
    widget: 'select',
    options: [
      { value: 'monthly', label: 'Monthly' },
      { value: 'annual', label: 'Annually' },
    ],
  },
  'compensation.breakup': {
    label: 'Compensation break-up (optional)',
    widget: 'textarea',
    helperText: 'Basic, HRA, allowances, bonus, ESOPs, etc.',
  },
  'compensation.variablePay': {
    label: 'Variable / performance pay (optional)',
    widget: 'textarea',
  },

  // Terms
  'terms.noticePeriodDays': { label: 'Notice period (days)', widget: 'number' },
  'terms.workingHours': {
    label: 'Working hours (optional)',
    placeholder: 'e.g. 9:30–18:30, Mon–Fri',
  },
  'terms.confidentiality': { label: 'Include confidentiality clause?' },
  'terms.ipAssignment': { label: 'Include IP assignment clause?' },
  'terms.backgroundCheck': { label: 'Offer subject to background verification?' },
  'terms.atWill': {
    label: 'At-will employment? (non-India)',
    helperText: 'Leave OFF for Indian employment — Indian law is not at-will.',
  },
  'terms.acceptBy': { label: 'Accept by (date)', widget: 'date' },
};

export const employmentOfferSectionOrder = [
  'offer',
  'company',
  'candidate',
  'role',
  'compensation',
  'terms',
];
