import type { RisksFunction, Warning } from '../types';
import type { QuotationData } from './schema';

/** Deterministic risk rules for quotations (NOT LLM outputs). */

type Data = Partial<QuotationData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-13';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.seller?.name)
      ? null
      : {
          id: 'quotation.seller_missing',
          severity: 'error',
          message: 'The issuing business / seller name is required.',
          fieldPath: 'seller.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.buyer?.name)
      ? null
      : {
          id: 'quotation.buyer_missing',
          severity: 'error',
          message: 'The client (to) name is required.',
          fieldPath: 'buyer.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.quote?.number)
      ? null
      : {
          id: 'quotation.number_missing',
          severity: 'error',
          message: 'A quotation number is required.',
          fieldPath: 'quote.number',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.quote?.date)
      ? null
      : {
          id: 'quotation.date_missing',
          severity: 'error',
          message: 'The quotation date is required.',
          fieldPath: 'quote.date',
          ruleVersion: V,
        },
  (data) => {
    const items = (data.items ?? []).filter(
      (it) => nonEmpty(it?.description) && (it?.quantity ?? 0) > 0,
    );
    return items.length
      ? null
      : {
          id: 'quotation.items_missing',
          severity: 'warning',
          message: 'Add at least one line item with a description and quantity.',
          fieldPath: 'items',
          ruleVersion: V,
        };
  },
  (data) => {
    const d = data.quote?.date;
    const until = data.quote?.validUntil;
    return d && until && until < d
      ? {
          id: 'quotation.valid_before_date',
          severity: 'warning',
          message: 'The "valid until" date is before the quotation date.',
          fieldPath: 'quote.validUntil',
          ruleVersion: V,
        }
      : null;
  },
  (data) =>
    !nonEmpty(data.quote?.validUntil)
      ? {
          id: 'quotation.validity_missing',
          severity: 'info',
          message:
            'No validity date set — quotations are usually time-bound (e.g. valid 30 days).',
          fieldPath: 'quote.validUntil',
          ruleVersion: V,
        }
      : null,
  (data) =>
    data.quote?.taxMode === 'gst' && !nonEmpty(data.seller?.gstin)
      ? {
          id: 'quotation.gstin_missing',
          severity: 'info',
          message: 'GST mode is on but the seller GSTIN is missing.',
          fieldPath: 'seller.gstin',
          ruleVersion: V,
        }
      : null,
  (data) =>
    data.quote?.taxMode === 'none' &&
    (data.items ?? []).some((it) => (it?.taxRate ?? 0) > 0)
      ? {
          id: 'quotation.tax_ignored',
          severity: 'info',
          message: 'Tax mode is "none" — per-item tax rates will be ignored.',
          fieldPath: 'quote.taxMode',
          ruleVersion: V,
        }
      : null,
];

export const quotationRisks: RisksFunction<Partial<QuotationData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
