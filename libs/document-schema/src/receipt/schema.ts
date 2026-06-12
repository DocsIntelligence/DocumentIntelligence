import { z } from 'zod';

/**
 * Payment Receipt — acknowledges money received. India + global (currency via
 * lookup). Simpler than an invoice: a single amount received "towards" a
 * purpose, by a payment mode, optionally part-payment with a running balance.
 *
 * Sections: receipt / payer / payee / payment / notes.
 */

const CURRENCY = z
  .enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'])
  .default('INR');

export const ReceiptMetaSchema = z.object({
  number: z.string().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  place: z.string().max(120).optional(),
  currency: CURRENCY,
});

export const ReceiptPartySchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  gstinPan: z.string().max(20).optional(),
});

export const ReceiptPaymentSchema = z.object({
  amount: z.coerce.number().min(0),
  towards: z.string().max(500),
  mode: z
    .enum(['cash', 'cheque', 'bank_transfer', 'upi', 'card', 'other'])
    .default('cash'),
  /** Cheque no. / UPI txn id / NEFT ref, depending on mode. */
  reference: z.string().max(120).optional(),
  bankName: z.string().max(160).optional(),
  /** This receipt is an advance / part payment toward a larger amount. */
  isPartPayment: z.boolean().default(false),
  totalAmount: z.coerce.number().min(0).optional(),
});

export const ReceiptNotesSchema = z.object({
  note: z.string().max(1000).optional(),
});

export const ReceiptSchema = z.object({
  receipt: ReceiptMetaSchema,
  payer: ReceiptPartySchema,
  payee: ReceiptPartySchema,
  payment: ReceiptPaymentSchema,
  notes: ReceiptNotesSchema,
});

export type ReceiptData = z.infer<typeof ReceiptSchema>;

/** Loose variant for autosave of half-filled drafts (top-level sections optional). */
export const ReceiptDraftSchema = ReceiptSchema.partial();
