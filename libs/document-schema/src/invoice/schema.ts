import { z } from 'zod';

/**
 * Invoice — a full-featured tax invoice for the Indian market and globally.
 *
 * Designed to cover the real cases:
 *  - tax modes: `gst` (India — CGST+SGST intra-state, IGST inter-state, per-item
 *    slab, HSN/SAC, place of supply, reverse charge), `single` (one flat
 *    VAT/sales-tax rate), or `none`;
 *  - prices tax-exclusive (default) or tax-inclusive;
 *  - per-line discount %, an invoice-level additional discount, and shipping;
 *  - multi-currency (₹ and others);
 *  - round-off and amount-paid → balance due.
 *
 * Totals are NOT stored — the template computes them from the line items so
 * they can never drift from the inputs. Every field sits under a section prefix
 * (invoice / seller / buyer / items / summary / payment / notes).
 */

const CURRENCY = z
  .enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'])
  .default('INR');

export const InvoiceItemSchema = z.object({
  description: z.string().min(1).max(300),
  hsnSac: z.string().max(20).optional(),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().max(20).optional(),
  rate: z.coerce.number().min(0).default(0),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
});

export const InvoiceMetaSchema = z.object({
  number: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  poReference: z.string().max(120).optional(),
  currency: CURRENCY,
  taxMode: z.enum(['gst', 'single', 'none']).default('gst'),
  pricesIncludeTax: z.boolean().default(false),
  placeOfSupply: z.string().max(120).optional(),
  reverseCharge: z.boolean().default(false),
  /** Label for `single` tax mode, e.g. "VAT", "Sales Tax". */
  singleTaxLabel: z.string().max(40).optional(),
});

export const InvoiceSellerSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  pincode: z.string().max(12).optional(),
  gstin: z.string().max(20).optional(),
  pan: z.string().max(12).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
});

export const InvoiceBuyerSchema = z.object({
  name: z.string().min(1).max(200),
  billingAddress: z.string().max(500).optional(),
  shippingAddress: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(120).optional(),
  pincode: z.string().max(12).optional(),
  gstin: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
});

export const InvoiceSummarySchema = z.object({
  /** Invoice-level discount amount (applied proportionally to the taxable base). */
  additionalDiscount: z.coerce.number().min(0).optional(),
  /** Shipping / freight / other charges (added after tax, untaxed). */
  shipping: z.coerce.number().min(0).optional(),
  roundOff: z.boolean().default(true),
  /** Amount already paid / advance — drives "balance due". */
  amountPaid: z.coerce.number().min(0).optional(),
});

export const InvoicePaymentSchema = z.object({
  terms: z.string().max(300).optional(),
  bankName: z.string().max(160).optional(),
  accountName: z.string().max(200).optional(),
  accountNumber: z.string().max(40).optional(),
  ifsc: z.string().max(20).optional(),
  upiId: z.string().max(80).optional(),
});

export const InvoiceNotesSchema = z.object({
  notes: z.string().max(1000).optional(),
  terms: z.string().max(1000).optional(),
});

export const InvoiceSchema = z.object({
  invoice: InvoiceMetaSchema,
  seller: InvoiceSellerSchema,
  buyer: InvoiceBuyerSchema,
  items: z.array(InvoiceItemSchema).min(1),
  summary: InvoiceSummarySchema,
  payment: InvoicePaymentSchema,
  notes: InvoiceNotesSchema,
});

export type InvoiceData = z.infer<typeof InvoiceSchema>;
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

/** Loose variant for autosave of half-filled drafts (top-level sections optional). */
export const InvoiceDraftSchema = InvoiceSchema.partial();
