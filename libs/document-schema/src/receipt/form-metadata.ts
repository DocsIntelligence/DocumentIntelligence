import type { FormMetadata } from '../types';

export const receiptFormMetadata: FormMetadata = {
  // Receipt meta
  'receipt.number': { label: 'Receipt number', placeholder: 'RCPT-2026-001' },
  'receipt.date': { label: 'Date', widget: 'date' },
  'receipt.place': { label: 'Place', placeholder: 'Mumbai' },
  'receipt.currency': {
    label: 'Currency',
    widget: 'lookup',
    lookupKey: 'currency',
  },

  // Payer (received from)
  'payer.name': { label: 'Received from — name' },
  'payer.address': { label: 'Payer address', widget: 'textarea' },
  'payer.gstinPan': { label: 'Payer GSTIN/PAN (optional)' },

  // Payee (issuer / received by)
  'payee.name': { label: 'Received by — name / business' },
  'payee.address': { label: 'Issuer address', widget: 'textarea' },
  'payee.gstinPan': { label: 'Issuer GSTIN/PAN (optional)' },

  // Payment
  'payment.amount': { label: 'Amount received', widget: 'number' },
  'payment.towards': {
    label: 'Received towards',
    widget: 'textarea',
    placeholder: 'e.g. rent for June 2026 / advance for order #123',
  },
  'payment.mode': {
    label: 'Payment mode',
    widget: 'lookup',
    lookupKey: 'payment_mode',
  },
  'payment.reference': {
    label: 'Reference (cheque no. / UPI txn / NEFT ref)',
  },
  'payment.bankName': {
    label: 'Bank',
    showIf: { field: 'payment.mode', in: ['cheque', 'bank_transfer'] },
  },
  'payment.isPartPayment': { label: 'Is this a part / advance payment?' },
  'payment.totalAmount': {
    label: 'Total amount due (for balance)',
    widget: 'number',
    showIf: { field: 'payment.isPartPayment', equals: true },
  },

  // Notes
  'notes.note': { label: 'Notes', widget: 'textarea' },
};

export const receiptSectionOrder = [
  'receipt',
  'payer',
  'payee',
  'payment',
  'notes',
];
