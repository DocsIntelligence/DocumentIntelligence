import type { FormMetadata } from '../types';

export const consumerComplaintFormMetadata: FormMetadata = {
  complaintDate: { label: 'Date of complaint', widget: 'date' },
  place: { label: 'Place', placeholder: 'Pune' },
  forum: {
    label: 'Commission (forum)',
    widget: 'select',
    options: [
      { value: 'district', label: 'District Commission (≤ ₹50 lakh)' },
      { value: 'state', label: 'State Commission (₹50 lakh – ₹2 crore)' },
      { value: 'national', label: 'National Commission (> ₹2 crore)' },
    ],
    helperText:
      'Pecuniary jurisdiction is fixed by the consideration PAID (not the relief claimed). The checks flag a mismatch.',
  },
  commissionName: {
    label: 'Full name of the Commission',
    placeholder: 'District Consumer Disputes Redressal Commission, Pune',
  },

  // Complainant
  'complainant.name': { label: 'Complainant — name' },
  'complainant.address': { label: 'Complainant address', widget: 'textarea' },
  'complainant.phone': { label: 'Complainant phone', widget: 'phone' },
  'complainant.email': { label: 'Complainant email' },
  'complainant.occupation': {
    label: 'Occupation',
    placeholder: 'e.g. Salaried / Business',
  },

  // Opposite parties
  oppositeParties: {
    label: 'Opposite party / parties',
    widget: 'group',
    itemLabel: 'Opposite party',
    maxItems: 8,
    helperText:
      'Name every party you seek relief against — manufacturer, seller, service provider, platform.',
    itemFields: {
      name: { label: 'Name' },
      address: {
        label: 'Address',
        widget: 'textarea',
        helperText:
          'A serviceable address grounds territorial jurisdiction under §34(2).',
      },
      role: { label: 'Role', placeholder: 'e.g. Seller / Manufacturer' },
    },
  },

  // Transaction
  'transaction.date': { label: 'Date of purchase / service', widget: 'date' },
  'transaction.description': {
    label: 'Goods bought / service availed',
    widget: 'textarea',
    aiPromptKey: 'consumer.describe_transaction',
  },
  'transaction.considerationPaid': {
    label: 'Consideration paid (₹)',
    widget: 'currency',
    helperText:
      'The amount actually paid. This — not the compensation you claim — fixes which Commission has jurisdiction.',
  },
  'transaction.reference': {
    label: 'Invoice / order / policy no.',
    placeholder: 'e.g. INV-2024-1182',
  },

  // Grievance
  grievanceType: {
    label: 'Nature of grievance',
    widget: 'select',
    options: [
      { value: 'defective_goods', label: 'Defective goods' },
      { value: 'deficiency_in_service', label: 'Deficiency in service' },
      { value: 'unfair_trade_practice', label: 'Unfair trade practice' },
      { value: 'overcharging', label: 'Overcharging' },
      { value: 'hazardous_goods', label: 'Hazardous goods / services' },
    ],
  },
  grievance: {
    label: 'What went wrong (the defect / deficiency)',
    widget: 'textarea',
    helperText:
      'Describe the defect, deficiency, or unfair practice and the loss/injury suffered.',
    aiPromptKey: 'consumer.describe_grievance',
  },
  causeOfActionDate: {
    label: 'Date the cause of action arose',
    widget: 'date',
    helperText:
      'Starts the 2-year limitation clock (§69). The complaint must be filed within 2 years.',
  },
  facts: {
    label: 'Additional facts (optional)',
    widget: 'list',
    helperText: 'One numbered paragraph per line, in chronological order.',
    aiPromptKey: 'consumer.tighten_facts',
  },

  // Reliefs
  reliefSought: {
    label: 'Reliefs prayed for',
    widget: 'list',
    helperText:
      'e.g. refund of ₹…, replacement, removal of defect, compensation for harassment, litigation costs.',
    aiPromptKey: 'consumer.suggest_reliefs',
  },
  compensationClaimed: {
    label: 'Compensation claimed (₹, optional)',
    widget: 'currency',
    helperText: 'Distinct from the consideration paid — does not change the forum.',
  },
  purchasedForCommercialPurpose: {
    label: 'Bought for a commercial purpose / resale?',
    helperText:
      'If yes, you may fall outside the definition of a “consumer” (§2(7)) — unless it was for self-employment to earn a livelihood.',
  },
};

export const consumerComplaintSectionOrder = [
  'complaintDate',
  'complainant',
  'oppositeParties',
  'transaction',
  'grievance',
  'reliefSought',
];
