import { z } from 'zod';
import {
  InvoiceBuyerSchema,
  InvoiceItemSchema,
  InvoiceSellerSchema,
} from '../invoice/schema';

/**
 * Credit / Debit Note — issued by a supplier against an earlier tax invoice
 * (GST-mandated in India; universal in accounting). A credit note reduces what
 * the buyer owes (returns, post-sale discount, deficiency); a debit note
 * increases it (under-charge, extra supply). Shares the invoice line-item + tax
 * engine. Sections: note / seller / buyer / items / summary / notes.
 */

const CURRENCY = z
  .enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'])
  .default('INR');

export const NoteMetaSchema = z.object({
  noteType: z.enum(['credit', 'debit']).default('credit'),
  number: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  currency: CURRENCY,
  taxMode: z.enum(['gst', 'single', 'none']).default('gst'),
  pricesIncludeTax: z.boolean().default(false),
  placeOfSupply: z.string().max(120).optional(),
  singleTaxLabel: z.string().max(40).optional(),
  /** The original invoice this note adjusts. */
  originalInvoiceNumber: z.string().max(60).optional(),
  originalInvoiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  /** Why the note is being issued (return, discount, under-charge, …). */
  reason: z.string().max(500).optional(),
});

export const NoteSummarySchema = z.object({
  additionalDiscount: z.coerce.number().min(0).optional(),
  shipping: z.coerce.number().min(0).optional(),
  roundOff: z.boolean().default(true),
});

export const NoteNotesSchema = z.object({
  notes: z.string().max(1000).optional(),
  terms: z.string().max(1000).optional(),
});

export const CreditNoteSchema = z.object({
  note: NoteMetaSchema,
  seller: InvoiceSellerSchema,
  buyer: InvoiceBuyerSchema,
  items: z.array(InvoiceItemSchema).min(1),
  summary: NoteSummarySchema,
  notes: NoteNotesSchema,
});

export type CreditNoteData = z.infer<typeof CreditNoteSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const CreditNoteDraftSchema = CreditNoteSchema.partial();
