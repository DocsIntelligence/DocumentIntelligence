import type { FormMetadata } from '../types';
import {
  COMMERCIAL_CURRENCY,
  COMMERCIAL_TAX_MODE,
  buyerFields,
  commercialItemFields,
  sellerFields,
} from '../_shared/commercial-fields';

export const quotationFormMetadata: FormMetadata = {
  // Quotation meta
  'quote.number': { label: 'Quotation number', placeholder: 'QUO-2026-001' },
  'quote.date': { label: 'Date', widget: 'date' },
  'quote.validUntil': { label: 'Valid until', widget: 'date' },
  'quote.currency': COMMERCIAL_CURRENCY,
  'quote.taxMode': {
    ...COMMERCIAL_TAX_MODE,
    helperText:
      'GST auto-splits into CGST+SGST (intra-state) or IGST (inter-state).',
  },
  'quote.pricesIncludeTax': {
    label: 'Prices are tax-inclusive?',
    helperText: 'If on, item rates already include tax; tax is back-calculated.',
  },
  'quote.placeOfSupply': {
    label: 'Place of supply (GST)',
    placeholder: 'State of supply',
    showIf: { field: 'quote.taxMode', equals: 'gst' },
    helperText: 'Determines CGST+SGST vs IGST. Defaults to the client’s state.',
  },
  'quote.singleTaxLabel': {
    label: 'Tax label',
    placeholder: 'VAT',
    showIf: { field: 'quote.taxMode', equals: 'single' },
  },

  // Seller (issuing the quote) / Buyer (client)
  ...sellerFields('seller', 'From'),
  ...buyerFields('buyer', 'To'),

  // Items
  items: {
    label: 'Line items',
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
  'summary.shipping': { label: 'Shipping / other charges', widget: 'number' },
  'summary.roundOff': { label: 'Round off total?' },

  // Notes
  'notes.notes': { label: 'Notes', widget: 'textarea' },
  'notes.terms': {
    label: 'Terms & conditions',
    widget: 'textarea',
    aiPromptKey: 'quotation.terms',
  },
};

export const quotationSectionOrder = [
  'quote',
  'seller',
  'buyer',
  'items',
  'summary',
  'notes',
];
