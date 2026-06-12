import type { FormMetadata } from '../types';
import {
  COMMERCIAL_CURRENCY,
  COMMERCIAL_TAX_MODE,
  commercialItemFields,
  sellerFields,
} from '../_shared/commercial-fields';

export const purchaseOrderFormMetadata: FormMetadata = {
  // PO meta
  'po.number': { label: 'PO number', placeholder: 'PO-2026-001' },
  'po.date': { label: 'PO date', widget: 'date' },
  'po.requiredBy': { label: 'Required by / delivery date', widget: 'date' },
  'po.currency': COMMERCIAL_CURRENCY,
  'po.taxMode': {
    ...COMMERCIAL_TAX_MODE,
    helperText:
      'GST auto-splits into CGST+SGST (intra-state) or IGST (inter-state).',
  },
  'po.pricesIncludeTax': {
    label: 'Prices are tax-inclusive?',
    helperText: 'If on, item rates already include tax; tax is back-calculated.',
  },
  'po.placeOfSupply': {
    label: 'Place of supply (GST)',
    placeholder: 'State of supply',
    showIf: { field: 'po.taxMode', equals: 'gst' },
  },
  'po.singleTaxLabel': {
    label: 'Tax label',
    placeholder: 'VAT',
    showIf: { field: 'po.taxMode', equals: 'single' },
  },
  'po.shipTo': {
    label: 'Ship to (if different from buyer address)',
    widget: 'textarea',
  },

  // Buyer (issuing org) / Vendor (supplier)
  ...sellerFields('buyer', 'Buyer'),
  ...sellerFields('vendor', 'Vendor'),

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
  'notes.notes': { label: 'Notes / instructions', widget: 'textarea' },
  'notes.terms': {
    label: 'Terms & conditions',
    widget: 'textarea',
    aiPromptKey: 'purchaseOrder.terms',
  },
};

export const purchaseOrderSectionOrder = [
  'po',
  'buyer',
  'vendor',
  'items',
  'summary',
  'notes',
];
