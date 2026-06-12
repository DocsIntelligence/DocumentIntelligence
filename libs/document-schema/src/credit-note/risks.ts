import type { RisksFunction, Warning } from '../types';
import type { CreditNoteData } from './schema';

/** Deterministic risk rules for credit/debit notes (NOT LLM outputs). */

type Data = Partial<CreditNoteData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-13';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.seller?.name)
      ? null
      : {
          id: 'creditNote.seller_missing',
          severity: 'error',
          message: 'The issuing seller name is required.',
          fieldPath: 'seller.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.buyer?.name)
      ? null
      : {
          id: 'creditNote.buyer_missing',
          severity: 'error',
          message: 'The buyer name is required.',
          fieldPath: 'buyer.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.note?.number)
      ? null
      : {
          id: 'creditNote.number_missing',
          severity: 'error',
          message: 'A note number is required.',
          fieldPath: 'note.number',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.note?.date)
      ? null
      : {
          id: 'creditNote.date_missing',
          severity: 'error',
          message: 'The note date is required.',
          fieldPath: 'note.date',
          ruleVersion: V,
        },
  (data) => {
    const items = (data.items ?? []).filter(
      (it) => nonEmpty(it?.description) && (it?.quantity ?? 0) > 0,
    );
    return items.length
      ? null
      : {
          id: 'creditNote.items_missing',
          severity: 'warning',
          message: 'Add at least one adjusted line item.',
          fieldPath: 'items',
          ruleVersion: V,
        };
  },
  (data) =>
    !nonEmpty(data.note?.originalInvoiceNumber)
      ? {
          id: 'creditNote.original_invoice_missing',
          severity: 'warning',
          message:
            'Reference the original invoice number — a credit/debit note adjusts a prior invoice (required under GST).',
          fieldPath: 'note.originalInvoiceNumber',
          ruleVersion: V,
        }
      : null,
  (data) =>
    !nonEmpty(data.note?.reason)
      ? {
          id: 'creditNote.reason_missing',
          severity: 'info',
          message: 'State the reason for the note (return, discount, under-charge).',
          fieldPath: 'note.reason',
          ruleVersion: V,
        }
      : null,
  (data) =>
    data.note?.taxMode === 'gst' && !nonEmpty(data.seller?.gstin)
      ? {
          id: 'creditNote.gstin_missing',
          severity: 'warning',
          message: 'GST mode is on but the seller GSTIN is missing.',
          fieldPath: 'seller.gstin',
          ruleVersion: V,
        }
      : null,
];

export const creditNoteRisks: RisksFunction<Partial<CreditNoteData>> = (
  data,
) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
