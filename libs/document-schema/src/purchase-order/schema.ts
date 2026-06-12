import { z } from 'zod';
import { InvoiceItemSchema, InvoiceSellerSchema } from '../invoice/schema';

/**
 * Purchase Order — a buyer-issued order to a vendor. Shares the invoice
 * line-item + tax engine. The issuing organisation (buyer) and the vendor are
 * both modelled with the seller party shape (name, address, GSTIN/PAN, contact).
 * Sections: po / buyer / vendor / items / summary / notes.
 */

const CURRENCY = z
  .enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'])
  .default('INR');

export const PoMetaSchema = z.object({
  number: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  requiredBy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  currency: CURRENCY,
  taxMode: z.enum(['gst', 'single', 'none']).default('gst'),
  pricesIncludeTax: z.boolean().default(false),
  placeOfSupply: z.string().max(120).optional(),
  singleTaxLabel: z.string().max(40).optional(),
  /** Where the goods are to be delivered, if different from the buyer address. */
  shipTo: z.string().max(500).optional(),
});

export const PoSummarySchema = z.object({
  additionalDiscount: z.coerce.number().min(0).optional(),
  shipping: z.coerce.number().min(0).optional(),
  roundOff: z.boolean().default(true),
});

export const PoNotesSchema = z.object({
  notes: z.string().max(1000).optional(),
  terms: z.string().max(1000).optional(),
});

export const PurchaseOrderSchema = z.object({
  po: PoMetaSchema,
  buyer: InvoiceSellerSchema,
  vendor: InvoiceSellerSchema,
  items: z.array(InvoiceItemSchema).min(1),
  summary: PoSummarySchema,
  notes: PoNotesSchema,
});

export type PurchaseOrderData = z.infer<typeof PurchaseOrderSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const PurchaseOrderDraftSchema = PurchaseOrderSchema.partial();
