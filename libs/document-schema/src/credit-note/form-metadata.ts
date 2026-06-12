import type { FormMetadata } from '../types';
import {
  COMMERCIAL_CURRENCY,
  COMMERCIAL_TAX_MODE,
  buyerFields,
  commercialItemFields,
  sellerFields,
} from '../_shared/commercial-fields';

export const creditNoteFormMetadata: FormMetadata = {
  // Note meta
  'note.noteType': {
    label: 'Note type',
    widget: 'lookup',
    lookupKey: 'credit_note_type',
    helperText:
      'Credit note reduces the amount due; debit note increases it.',
  },
  'note.number': { label: 'Note number', placeholder: 'CN-2026-001' },
  'note.date': { label: 'Date', widget: 'date' },
  'note.currency': COMMERCIAL_CURRENCY,
  'note.taxMode': {
    ...COMMERCIAL_TAX_MODE,
    helperText:
      'GST auto-splits into CGST+SGST (intra-state) or IGST (inter-state).',
  },
  'note.pricesIncludeTax': {
    label: 'Prices are tax-inclusive?',
    helperText: 'If on, item rates already include tax; tax is back-calculated.',
  },
  'note.placeOfSupply': {
    label: 'Place of supply (GST)',
    placeholder: 'State of supply',
    showIf: { field: 'note.taxMode', equals: 'gst' },
  },
  'note.singleTaxLabel': {
    label: 'Tax label',
    placeholder: 'VAT',
    showIf: { field: 'note.taxMode', equals: 'single' },
  },
  'note.originalInvoiceNumber': { label: 'Against invoice number' },
  'note.originalInvoiceDate': { label: 'Original invoice date', widget: 'date' },
  'note.reason': {
    label: 'Reason',
    widget: 'textarea',
    placeholder: 'e.g. return of goods / post-sale discount / under-charge',
  },

  // Seller (issuer) / Buyer
  ...sellerFields('seller', 'Seller'),
  ...buyerFields('buyer', 'Buyer'),

  // Items
  items: {
    label: 'Line items (adjusted amounts)',
    widget: 'group',
    itemLabel: 'Item',
    maxItems: 100,
    itemFields: commercialItemFields,
  },

  // Summary
  'summary.additionalDiscount': {
    label: 'Additional discount (amount)',
    widget: 'number',
  },
  'summary.shipping': { label: 'Other charges', widget: 'number' },
  'summary.roundOff': { label: 'Round off total?' },

  // Notes
  'notes.notes': { label: 'Notes', widget: 'textarea' },
  'notes.terms': { label: 'Terms & conditions', widget: 'textarea' },
};

export const creditNoteSectionOrder = [
  'note',
  'seller',
  'buyer',
  'items',
  'summary',
  'notes',
];
