import type { FormMetadata } from '../types';

/**
 * Shared form-metadata field groups for invoice-family documents (invoice,
 * quotation, purchase order, credit/debit note). Keeps seller/buyer/item field
 * definitions in one place. Matches `InvoiceSellerSchema`/`InvoiceBuyerSchema`/
 * `InvoiceItemSchema` shapes in `../invoice/schema`.
 */

export const commercialItemFields: FormMetadata = {
  description: { label: 'Description' },
  hsnSac: { label: 'HSN/SAC' },
  quantity: { label: 'Qty', widget: 'number' },
  unit: { label: 'Unit', placeholder: 'pcs / hrs' },
  rate: { label: 'Rate', widget: 'number' },
  discountPct: { label: 'Discount %', widget: 'number' },
  taxRate: { label: 'Tax %', widget: 'number' },
};

export function sellerFields(prefix: string, who = 'Seller'): FormMetadata {
  return {
    [`${prefix}.name`]: { label: `${who} — name` },
    [`${prefix}.address`]: { label: `${who} — address`, widget: 'textarea' },
    [`${prefix}.city`]: { label: `${who} — city` },
    [`${prefix}.state`]: { label: `${who} — state` },
    [`${prefix}.pincode`]: { label: `${who} — PIN / ZIP` },
    [`${prefix}.gstin`]: { label: `${who} — GSTIN` },
    [`${prefix}.pan`]: { label: `${who} — PAN` },
    [`${prefix}.email`]: { label: `${who} — email` },
    [`${prefix}.phone`]: { label: `${who} — phone`, widget: 'phone' },
  };
}

export function buyerFields(prefix: string, who = 'Buyer'): FormMetadata {
  return {
    [`${prefix}.name`]: { label: `${who} — name` },
    [`${prefix}.billingAddress`]: {
      label: `${who} — billing address`,
      widget: 'textarea',
    },
    [`${prefix}.shippingAddress`]: {
      label: `${who} — shipping address (if different)`,
      widget: 'textarea',
    },
    [`${prefix}.city`]: { label: `${who} — city` },
    [`${prefix}.state`]: { label: `${who} — state` },
    [`${prefix}.pincode`]: { label: `${who} — PIN / ZIP` },
    [`${prefix}.gstin`]: { label: `${who} — GSTIN (optional)` },
    [`${prefix}.email`]: { label: `${who} — email` },
    [`${prefix}.phone`]: { label: `${who} — phone`, widget: 'phone' },
  };
}

export const COMMERCIAL_CURRENCY = {
  label: 'Currency',
  widget: 'lookup' as const,
  lookupKey: 'currency',
};
export const COMMERCIAL_TAX_MODE = {
  label: 'Tax mode',
  widget: 'lookup' as const,
  lookupKey: 'invoice_tax_mode',
};
