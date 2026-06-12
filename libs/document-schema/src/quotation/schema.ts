import { z } from 'zod';
import {
  InvoiceBuyerSchema,
  InvoiceItemSchema,
  InvoiceSellerSchema,
} from '../invoice/schema';

/**
 * Quotation / Estimate — a priced proposal. Shares the invoice line-item +
 * tax engine; differs in having a "valid until" date and no payment/balance.
 * Sections: quote / seller / buyer / items / summary / notes.
 */

const CURRENCY = z
  .enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'])
  .default('INR');

export const QuoteMetaSchema = z.object({
  number: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  currency: CURRENCY,
  taxMode: z.enum(['gst', 'single', 'none']).default('gst'),
  pricesIncludeTax: z.boolean().default(false),
  placeOfSupply: z.string().max(120).optional(),
  singleTaxLabel: z.string().max(40).optional(),
});

export const QuoteSummarySchema = z.object({
  additionalDiscount: z.coerce.number().min(0).optional(),
  shipping: z.coerce.number().min(0).optional(),
  roundOff: z.boolean().default(true),
});

export const QuoteNotesSchema = z.object({
  notes: z.string().max(1000).optional(),
  terms: z.string().max(1000).optional(),
});

export const QuotationSchema = z.object({
  quote: QuoteMetaSchema,
  seller: InvoiceSellerSchema,
  buyer: InvoiceBuyerSchema,
  items: z.array(InvoiceItemSchema).min(1),
  summary: QuoteSummarySchema,
  notes: QuoteNotesSchema,
});

export type QuotationData = z.infer<typeof QuotationSchema>;

export const QuotationDraftSchema = QuotationSchema.partial();
