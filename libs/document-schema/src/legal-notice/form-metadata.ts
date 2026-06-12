import type { FormMetadata } from '../types';

export const legalNoticeFormMetadata: FormMetadata = {
  noticeType: {
    label: 'Notice type',
    widget: 'lookup',
    lookupKey: 'notice_type',
    helperText:
      'Drives the statutory framing (e.g. cheque bounce → NI Act §138).',
  },
  deliveryMode: {
    label: 'Mode of service',
    widget: 'lookup',
    lookupKey: 'notice_delivery_mode',
  },
  throughAdvocate: {
    label: 'Issued through an advocate?',
    helperText:
      'If yes, the notice is framed “under instructions from my client”.',
  },
  place: { label: 'Place', placeholder: 'Mumbai' },
  noticeDate: { label: 'Date of notice', widget: 'date' },

  // Advocate
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

  // Sender (client) / recipient
  'sender.name': { label: 'Client (sender) — name' },
  'sender.address': { label: 'Client address', widget: 'textarea' },
  'sender.phone': { label: 'Client phone', widget: 'phone' },
  'sender.email': { label: 'Client email' },
  'recipient.name': { label: 'Noticee (recipient) — name' },
  'recipient.address': { label: 'Noticee address', widget: 'textarea' },
  'recipient.phone': { label: 'Noticee phone', widget: 'phone' },
  'recipient.email': { label: 'Noticee email' },

  // Content
  'content.subject': {
    label: 'Subject',
    placeholder: 'e.g. Demand for repayment of ₹…',
  },
  'content.facts': {
    label: 'Facts / background',
    widget: 'list',
    helperText: 'One numbered paragraph per line, in chronological order.',
    aiPromptKey: 'notice.tighten_facts',
  },
  'content.demandText': {
    label: 'Demand',
    widget: 'textarea',
    aiPromptKey: 'notice.draft_demand',
  },
  'content.demandAmount': { label: 'Amount demanded (₹)', widget: 'currency' },
  'content.complianceDays': {
    label: 'Days to comply',
    widget: 'number',
    helperText:
      'Cheque bounce: the drawer has 15 days from receipt to pay (NI Act §138 proviso).',
  },
  'content.causeOfActionDate': {
    label: 'Cause of action — date',
    widget: 'date',
  },
  'content.causeOfActionPlace': { label: 'Cause of action — place' },

  // Cheque (cheque-bounce only)
  'cheque.number': {
    label: 'Cheque number',
    showIf: { field: 'noticeType', equals: 'cheque_bounce' },
  },
  'cheque.amount': {
    label: 'Cheque amount (₹)',
    widget: 'currency',
    showIf: { field: 'noticeType', equals: 'cheque_bounce' },
  },
  'cheque.bankName': {
    label: 'Drawee bank',
    showIf: { field: 'noticeType', equals: 'cheque_bounce' },
  },
  'cheque.chequeDate': {
    label: 'Cheque date',
    widget: 'date',
    showIf: { field: 'noticeType', equals: 'cheque_bounce' },
  },
  'cheque.presentedDate': {
    label: 'Date presented',
    widget: 'date',
    showIf: { field: 'noticeType', equals: 'cheque_bounce' },
  },
  'cheque.dishonourDate': {
    label: 'Date of dishonour (return memo)',
    widget: 'date',
    showIf: { field: 'noticeType', equals: 'cheque_bounce' },
  },
  'cheque.dishonourReason': {
    label: 'Reason for dishonour',
    placeholder: 'e.g. Funds insufficient',
    showIf: { field: 'noticeType', equals: 'cheque_bounce' },
  },
};

export const legalNoticeSectionOrder = [
  'noticeType',
  'advocate',
  'sender',
  'recipient',
  'content',
  'cheque',
];
