import type { RisksFunction, Warning } from '../types';
import type { InvoiceData } from './schema';

/** Deterministic risk rules for invoices (NOT LLM outputs). */

type Data = Partial<InvoiceData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-12';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.seller?.name)
      ? null
      : {
          id: 'invoice.seller_missing',
          severity: 'error',
          message: 'The seller / business name is required.',
          fieldPath: 'seller.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.buyer?.name)
      ? null
      : {
          id: 'invoice.buyer_missing',
          severity: 'error',
          message: 'The bill-to (buyer) name is required.',
          fieldPath: 'buyer.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.invoice?.number)
      ? null
      : {
          id: 'invoice.number_missing',
          severity: 'error',
          message: 'An invoice number is required.',
          fieldPath: 'invoice.number',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.invoice?.date)
      ? null
      : {
          id: 'invoice.date_missing',
          severity: 'error',
          message: 'The invoice date is required.',
          fieldPath: 'invoice.date',
          ruleVersion: V,
        },
  (data) => {
    const items = (data.items ?? []).filter(
      (it) => nonEmpty(it?.description) && (it?.quantity ?? 0) > 0,
    );
    return items.length
      ? null
      : {
          id: 'invoice.items_missing',
          severity: 'warning',
          message: 'Add at least one line item with a description and quantity.',
          fieldPath: 'items',
          ruleVersion: V,
        };
  },
  (data) =>
    data.invoice?.taxMode === 'gst' && !nonEmpty(data.seller?.gstin)
      ? {
          id: 'invoice.gstin_missing',
          severity: 'warning',
          message:
            'GST mode is on but the seller GSTIN is missing. A tax invoice must carry the supplier’s GSTIN.',
          fieldPath: 'seller.gstin',
          ruleVersion: V,
        }
      : null,
  (data) => {
    const g = data.seller?.gstin?.replace(/\s/g, '');
    return data.invoice?.taxMode === 'gst' && g && g.length !== 15
      ? {
          id: 'invoice.gstin_format',
          severity: 'info',
          message: 'A GSTIN is 15 characters — double-check the seller GSTIN.',
          fieldPath: 'seller.gstin',
          ruleVersion: V,
        }
      : null;
  },
  (data) => {
    if (data.invoice?.taxMode !== 'gst') return null;
    const ss = data.seller?.state?.trim().toLowerCase();
    const bs = (data.invoice?.placeOfSupply || data.buyer?.state || '')
      .trim()
      .toLowerCase();
    return ss && bs && ss !== bs && !nonEmpty(data.invoice?.placeOfSupply)
      ? {
          id: 'invoice.place_of_supply',
          severity: 'info',
          message:
            'Seller and buyer states differ (inter-state → IGST). Set the place of supply explicitly to be sure.',
          fieldPath: 'invoice.placeOfSupply',
          ruleVersion: V,
        }
      : null;
  },
  (data) => {
    const d = data.invoice?.date;
    const due = data.invoice?.dueDate;
    return d && due && due < d
      ? {
          id: 'invoice.due_before_date',
          severity: 'warning',
          message: 'The due date is before the invoice date.',
          fieldPath: 'invoice.dueDate',
          ruleVersion: V,
        }
      : null;
  },
  (data) =>
    data.invoice?.taxMode === 'none' &&
    (data.items ?? []).some((it) => (it?.taxRate ?? 0) > 0)
      ? {
          id: 'invoice.tax_ignored',
          severity: 'info',
          message: 'Tax mode is "none" — per-item tax rates will be ignored.',
          fieldPath: 'invoice.taxMode',
          ruleVersion: V,
        }
      : null,
  (data) =>
    data.invoice?.reverseCharge
      ? {
          id: 'invoice.reverse_charge',
          severity: 'info',
          message:
            'Reverse charge is marked — the recipient is liable to pay GST; the invoice must state this prominently.',
          fieldPath: 'invoice.reverseCharge',
          ruleVersion: V,
        }
      : null,
];

export const invoiceRisks: RisksFunction<Partial<InvoiceData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
