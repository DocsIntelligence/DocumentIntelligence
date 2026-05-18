import type { FormMetadata } from '../types';

export const rentAgreementFormMetadata: FormMetadata = {
  state: {
    label: 'State',
    helperText:
      'Governs registration thresholds, stamp duty, and Model Tenancy Act applicability.',
    widget: 'lookup',
    lookupKey: 'in_states',
  },
  city: { label: 'City', placeholder: 'Mumbai, Bengaluru, …' },
  executionDate: {
    label: 'Date of execution',
    helperText: 'Date the agreement is signed.',
    widget: 'date',
  },
  registered: {
    label: 'Will this be registered with the sub-registrar?',
    helperText:
      'In several states (MH/KA/DL) registration is mandatory above certain rent+deposit thresholds.',
  },
  registrationOffice: {
    label: 'Sub-registrar office',
    showIf: { field: 'registered', equals: true },
  },

  // Parties
  'parties.landlord.name': { label: 'Landlord — full name' },
  'parties.landlord.parentRelation': { label: 'Relation', widget: 'select' },
  'parties.landlord.parentName': {
    label: "Father/Husband/Mother's name",
    aiPromptKey: 'parties.parent_format',
  },
  'parties.landlord.age': { label: 'Age', widget: 'number' },
  'parties.landlord.occupation': { label: 'Occupation' },
  'parties.landlord.pan': { label: 'PAN', widget: 'pan' },
  'parties.landlord.aadhaarMasked': {
    label: 'Aadhaar (masked, last 4 digits)',
    widget: 'aadhaar',
    helperText: 'Only the masked form is stored. Format: XXXX XXXX 1234.',
  },
  'parties.landlord.phone': { label: 'Phone', widget: 'phone' },
  'parties.landlord.email': { label: 'Email' },
  'parties.landlord.address': { label: 'Permanent address', widget: 'textarea' },

  'parties.tenant.name': { label: 'Tenant — full name' },
  'parties.tenant.parentRelation': { label: 'Relation', widget: 'select' },
  'parties.tenant.parentName': { label: "Father/Husband/Mother's name" },
  'parties.tenant.age': { label: 'Age', widget: 'number' },
  'parties.tenant.occupation': { label: 'Occupation' },
  'parties.tenant.pan': { label: 'PAN', widget: 'pan' },
  'parties.tenant.aadhaarMasked': {
    label: 'Aadhaar (masked)',
    widget: 'aadhaar',
  },
  'parties.tenant.phone': { label: 'Phone', widget: 'phone' },
  'parties.tenant.email': { label: 'Email' },
  'parties.tenant.address': {
    label: 'Permanent address',
    widget: 'textarea',
  },

  // Property
  'property.address': { label: 'Full address of premises', widget: 'address' },
  'property.city': { label: 'City' },
  'property.state': { label: 'State' },
  'property.pincode': { label: 'PIN code', widget: 'pincode' },
  'property.type': { label: 'Property type', widget: 'select' },
  'property.builtUpAreaSqft': { label: 'Built-up area (sq ft)', widget: 'number' },
  'property.furnished': { label: 'Furnishing', widget: 'select' },
  'property.inventory': {
    label: 'Inventory of fittings/fixtures',
    helperText: 'One item per line. Important for deposit-deduction disputes.',
  },

  // Term
  'term.startDate': { label: 'Tenancy start date', widget: 'date' },
  'term.durationMonths': {
    label: 'Duration (months)',
    widget: 'number',
    helperText:
      'Most landlords use 11 months to avoid the registration requirement under §17 Registration Act.',
  },
  'term.renewable': { label: 'Renewable by mutual consent' },
  'term.noticePeriodDays': {
    label: 'Notice period (days)',
    widget: 'number',
    helperText: 'Typical: 30–60 days.',
  },
  'term.lockInMonths': {
    label: 'Lock-in (months)',
    widget: 'number',
    aiPromptKey: 'term.lockin_explain',
  },

  // Rent & deposit
  'rent_deposit.rentMonthly': { label: 'Monthly rent (₹)', widget: 'currency' },
  'rent_deposit.rentDueDay': {
    label: 'Rent due day of month',
    widget: 'number',
  },
  'rent_deposit.depositAmount': {
    label: 'Security deposit (₹)',
    widget: 'currency',
    helperText:
      'KA caps deposit at 10 months rent; Model Tenancy Act caps at 2 (residential).',
  },
  'rent_deposit.depositReturnDays': {
    label: 'Days to return deposit after vacation',
    widget: 'number',
  },
  'rent_deposit.escalationPercent': {
    label: 'Escalation %',
    widget: 'number',
  },
  'rent_deposit.escalationEveryMonths': {
    label: 'Escalation every (months)',
    widget: 'number',
    showIf: { field: 'rent_deposit.escalationPercent', gt: 0 },
  },
  'rent_deposit.lateFeePerDay': {
    label: 'Late fee (₹/day)',
    widget: 'number',
  },

  // Utilities
  'utilities.electricityPaidBy': { label: 'Electricity', widget: 'select' },
  'utilities.waterPaidBy': { label: 'Water', widget: 'select' },
  'utilities.maintenancePaidBy': { label: 'Maintenance', widget: 'select' },
  'utilities.internetPaidBy': { label: 'Internet', widget: 'select' },
  'utilities.societyChargesPaidBy': {
    label: 'Society charges',
    widget: 'select',
  },
  'utilities.propertyTaxPaidBy': { label: 'Property tax', widget: 'select' },

  // Rules
  'rules.petsAllowed': { label: 'Pets allowed' },
  'rules.subletAllowed': { label: 'Sublet allowed' },
  'rules.alterationsAllowed': { label: 'Alterations allowed' },
  'rules.smokingAllowed': { label: 'Smoking allowed' },
  'rules.maxOccupants': {
    label: 'Maximum occupants',
    widget: 'number',
  },
  'rules.commercialUseAllowed': { label: 'Commercial use allowed' },
  'rules.customRules': {
    label: 'Additional rules',
    helperText: 'One rule per line.',
    aiPromptKey: 'rules.suggest',
  },

  // Witnesses
  'witnesses.0.name': { label: 'Witness 1 — name' },
  'witnesses.0.address': { label: 'Witness 1 — address' },
  'witnesses.1.name': { label: 'Witness 2 — name' },
  'witnesses.1.address': { label: 'Witness 2 — address' },
};

export const rentAgreementSectionOrder = [
  'state',
  'parties.landlord',
  'parties.tenant',
  'property',
  'term',
  'rent_deposit',
  'utilities',
  'rules',
  'witnesses',
];
