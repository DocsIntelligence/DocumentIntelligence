import type { FormMetadata } from '../types';

export const chequeBounceNoticeFormMetadata: FormMetadata = {
  noticeDate: { label: 'Date of notice', widget: 'date' },
  place: { label: 'Place', placeholder: 'Mumbai' },
  deliveryMode: {
    label: 'Mode of service',
    widget: 'select',
    options: [
      { value: 'registered_post_ad', label: 'Registered Post A/D' },
      { value: 'speed_post', label: 'Speed Post' },
      { value: 'courier', label: 'Courier' },
      { value: 'email', label: 'Email' },
      { value: 'hand', label: 'By hand' },
    ],
    helperText:
      'Registered Post A/D is preferred — it evidences service, which starts the drawer’s 15-day clock.',
  },
  throughAdvocate: {
    label: 'Issued through an advocate?',
    helperText:
      'If yes, the notice is framed “under instructions from my client”.',
  },

  // Advocate (optional)
  'advocate.name': {
    label: 'Advocate — name',
    showIf: { field: 'throughAdvocate', equals: true },
  },
  'advocate.enrollmentNo': {
    label: 'Bar enrolment no.',
    showIf: { field: 'throughAdvocate', equals: true },
  },
  'advocate.address': {
    label: 'Advocate office address',
    widget: 'textarea',
    showIf: { field: 'throughAdvocate', equals: true },
  },
  'advocate.phone': {
    label: 'Advocate phone',
    widget: 'phone',
    showIf: { field: 'throughAdvocate', equals: true },
  },
  'advocate.email': {
    label: 'Advocate email',
    showIf: { field: 'throughAdvocate', equals: true },
  },

  // Payee (client / complainant)
  'payee.name': { label: 'Payee (client) — name' },
  'payee.address': { label: 'Payee address', widget: 'textarea' },
  'payee.phone': { label: 'Payee phone', widget: 'phone' },
  'payee.email': { label: 'Payee email' },

  // Drawer (noticee)
  'drawer.name': { label: 'Drawer (noticee) — name' },
  'drawer.address': {
    label: 'Drawer address',
    widget: 'textarea',
    helperText: 'A serviceable address is essential — service makes the notice effective.',
  },
  'drawer.phone': { label: 'Drawer phone', widget: 'phone' },
  'drawer.email': { label: 'Drawer email' },
  'drawer.isCompany': {
    label: 'Drawer is a company / firm?',
    helperText:
      'If yes, the officers in charge are also liable under NI Act §141 — name them below.',
  },
  'drawer.officers': {
    label: 'Officers in charge (§141)',
    widget: 'list',
    helperText: 'Directors / partners in charge of the business at the time.',
    showIf: { field: 'drawer.isCompany', equals: true },
  },

  // Cheque particulars
  'cheque.number': { label: 'Cheque number' },
  'cheque.amount': { label: 'Cheque amount (₹)', widget: 'currency' },
  'cheque.bankName': { label: 'Drawee bank' },
  'cheque.branch': { label: 'Branch' },
  'cheque.chequeDate': { label: 'Cheque date', widget: 'date' },
  'cheque.presentedDate': {
    label: 'Date presented',
    widget: 'date',
    helperText: 'A cheque is valid for 3 months — present within validity.',
  },
  'cheque.dishonourDate': {
    label: 'Date of dishonour (return memo)',
    widget: 'date',
    helperText: 'Starts the 30-day window to issue this demand notice (§138 proviso (b)).',
  },
  'cheque.dishonourReason': {
    label: 'Reason for dishonour',
    placeholder: 'e.g. Funds insufficient',
  },

  // Liability + demand
  underlyingLiability: {
    label: 'What the cheque was for (legally enforceable debt/liability)',
    widget: 'textarea',
    helperText:
      '§138 applies only when the cheque discharges a legally enforceable debt or liability.',
    aiPromptKey: 'cheque.describe_liability',
  },
  facts: {
    label: 'Additional facts (optional)',
    widget: 'list',
    helperText: 'One numbered paragraph per line, in chronological order.',
    aiPromptKey: 'cheque.tighten_facts',
  },
  demandAmount: {
    label: 'Amount demanded (₹)',
    widget: 'currency',
    helperText: 'Normally the cheque amount; you may add documented costs.',
  },
  complianceDays: {
    label: 'Days to pay (from receipt)',
    widget: 'number',
    helperText: 'Statutory minimum is 15 days (§138 proviso (c)).',
  },
};

export const chequeBounceNoticeSectionOrder = [
  'noticeDate',
  'advocate',
  'payee',
  'drawer',
  'cheque',
  'underlyingLiability',
  'demandAmount',
];
