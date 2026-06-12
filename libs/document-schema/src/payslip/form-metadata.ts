import type { FormMetadata } from '../types';

const componentFields: FormMetadata = {
  component: { label: 'Component', placeholder: 'Basic / HRA / PF …' },
  amount: { label: 'Amount', widget: 'number' },
};

export const payslipFormMetadata: FormMetadata = {
  // Payslip meta
  'payslip.payPeriodLabel': {
    label: 'Pay period',
    placeholder: 'June 2026',
  },
  'payslip.payDate': { label: 'Pay date', widget: 'date' },
  'payslip.currency': {
    label: 'Currency',
    widget: 'lookup',
    lookupKey: 'currency',
  },
  'payslip.paidDays': { label: 'Paid days', widget: 'number' },
  'payslip.lopDays': { label: 'Loss-of-pay (LOP) days', widget: 'number' },

  // Employer
  'employer.name': { label: 'Employer / company name' },
  'employer.address': { label: 'Address', widget: 'textarea' },
  'employer.gstinPan': { label: 'GSTIN / PAN (optional)' },

  // Employee
  'employee.name': { label: 'Employee name' },
  'employee.code': { label: 'Employee ID / code' },
  'employee.designation': { label: 'Designation' },
  'employee.department': { label: 'Department' },
  'employee.pan': { label: 'PAN (optional)' },
  'employee.uan': { label: 'UAN (PF, optional)' },
  'employee.esiNumber': { label: 'ESI number (optional)' },
  'employee.bankName': { label: 'Bank name' },
  'employee.bankAccount': { label: 'Bank account number' },
  'employee.dateOfJoining': { label: 'Date of joining', widget: 'date' },

  // Earnings / deductions
  earnings: {
    label: 'Earnings',
    widget: 'group',
    itemLabel: 'Earning',
    maxItems: 30,
    itemFields: componentFields,
  },
  deductions: {
    label: 'Deductions',
    widget: 'group',
    itemLabel: 'Deduction',
    maxItems: 30,
    itemFields: componentFields,
  },

  // Notes
  'notes.note': { label: 'Notes', widget: 'textarea' },
};

export const payslipSectionOrder = [
  'payslip',
  'employer',
  'employee',
  'earnings',
  'deductions',
  'notes',
];
