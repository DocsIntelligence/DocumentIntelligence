import type { FormMetadata } from '../types';

export const invoiceFormMetadata: FormMetadata = {
  // Invoice meta
  'invoice.number': { label: 'Invoice number', placeholder: 'INV-2026-001' },
  'invoice.date': { label: 'Invoice date', widget: 'date' },
  'invoice.dueDate': { label: 'Due date', widget: 'date' },
  'invoice.poReference': { label: 'PO / reference (optional)' },
  'invoice.currency': {
    label: 'Currency',
    widget: 'lookup',
    lookupKey: 'currency',
  },
  'invoice.taxMode': {
    label: 'Tax mode',
    widget: 'lookup',
    lookupKey: 'invoice_tax_mode',
    helperText: 'GST auto-splits into CGST+SGST (intra-state) or IGST (inter-state).',
  },
  'invoice.pricesIncludeTax': {
    label: 'Prices are tax-inclusive?',
    helperText: 'If on, item rates already include tax; tax is back-calculated.',
  },
  'invoice.placeOfSupply': {
    label: 'Place of supply (GST)',
    placeholder: 'State of supply',
    showIf: { field: 'invoice.taxMode', equals: 'gst' },
    helperText: 'Determines CGST+SGST vs IGST. Defaults to the buyer’s state.',
  },
  'invoice.reverseCharge': {
    label: 'Reverse charge applicable?',
    showIf: { field: 'invoice.taxMode', equals: 'gst' },
  },
  'invoice.singleTaxLabel': {
    label: 'Tax label',
    placeholder: 'VAT',
    showIf: { field: 'invoice.taxMode', equals: 'single' },
  },

  // Seller
  'seller.name': { label: 'Your business / seller name' },
  'seller.address': { label: 'Address', widget: 'textarea' },
  'seller.city': { label: 'City' },
  'seller.state': { label: 'State' },
  'seller.pincode': { label: 'PIN / ZIP' },
  'seller.gstin': {
    label: 'GSTIN',
    showIf: { field: 'invoice.taxMode', equals: 'gst' },
  },
  'seller.pan': { label: 'PAN (optional)' },
  'seller.email': { label: 'Email' },
  'seller.phone': { label: 'Phone', widget: 'phone' },

  // Buyer
  'buyer.name': { label: 'Bill to — name' },
  'buyer.billingAddress': { label: 'Billing address', widget: 'textarea' },
  'buyer.shippingAddress': {
    label: 'Shipping address (if different)',
    widget: 'textarea',
  },
  'buyer.city': { label: 'City' },
  'buyer.state': { label: 'State' },
  'buyer.pincode': { label: 'PIN / ZIP' },
  'buyer.gstin': {
    label: 'Buyer GSTIN (optional)',
    showIf: { field: 'invoice.taxMode', equals: 'gst' },
  },
  'buyer.email': { label: 'Email' },
  'buyer.phone': { label: 'Phone', widget: 'phone' },

  // Items
  items: {
    label: 'Line items',
    widget: 'group',
    itemLabel: 'Item',
    maxItems: 100,
    itemFields: {
      description: { label: 'Description' },
      hsnSac: { label: 'HSN/SAC' },
      quantity: { label: 'Qty', widget: 'number' },
      unit: { label: 'Unit', placeholder: 'pcs / hrs' },
      rate: { label: 'Rate', widget: 'number' },
      discountPct: { label: 'Discount %', widget: 'number' },
      taxRate: { label: 'Tax %', widget: 'number' },
    },
  },

  // Summary
  'summary.additionalDiscount': {
    label: 'Additional discount (amount)',
    widget: 'number',
  },
  'summary.shipping': { label: 'Shipping / other charges', widget: 'number' },
  'summary.roundOff': { label: 'Round off total?' },
  'summary.amountPaid': { label: 'Amount already paid / advance', widget: 'number' },

  // Payment
  'payment.terms': { label: 'Payment terms', placeholder: 'Net 15' },
  'payment.bankName': { label: 'Bank name' },
  'payment.accountName': { label: 'Account holder name' },
  'payment.accountNumber': { label: 'Account number' },
  'payment.ifsc': { label: 'IFSC / SWIFT' },
  'payment.upiId': { label: 'UPI ID' },

  // Notes
  'notes.notes': { label: 'Notes', widget: 'textarea' },
  'notes.terms': {
    label: 'Terms & conditions',
    widget: 'textarea',
    aiPromptKey: 'invoice.terms',
  },
};

export const invoiceSectionOrder = [
  'invoice',
  'seller',
  'buyer',
  'items',
  'summary',
  'payment',
  'notes',
];
