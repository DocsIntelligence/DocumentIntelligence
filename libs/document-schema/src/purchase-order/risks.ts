import type { RisksFunction, Warning } from '../types';
import type { PurchaseOrderData } from './schema';

/** Deterministic risk rules for purchase orders (NOT LLM outputs). */

type Data = Partial<PurchaseOrderData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-13';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.buyer?.name)
      ? null
      : {
          id: 'po.buyer_missing',
          severity: 'error',
          message: 'The buyer (issuing organisation) name is required.',
          fieldPath: 'buyer.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.vendor?.name)
      ? null
      : {
          id: 'po.vendor_missing',
          severity: 'error',
          message: 'The vendor (supplier) name is required.',
          fieldPath: 'vendor.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.po?.number)
      ? null
      : {
          id: 'po.number_missing',
          severity: 'error',
          message: 'A PO number is required.',
          fieldPath: 'po.number',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.po?.date)
      ? null
      : {
          id: 'po.date_missing',
          severity: 'error',
          message: 'The PO date is required.',
          fieldPath: 'po.date',
          ruleVersion: V,
        },
  (data) => {
    const items = (data.items ?? []).filter(
      (it) => nonEmpty(it?.description) && (it?.quantity ?? 0) > 0,
    );
    return items.length
      ? null
      : {
          id: 'po.items_missing',
          severity: 'warning',
          message: 'Add at least one line item with a description and quantity.',
          fieldPath: 'items',
          ruleVersion: V,
        };
  },
  (data) => {
    const d = data.po?.date;
    const req = data.po?.requiredBy;
    return d && req && req < d
      ? {
          id: 'po.required_before_date',
          severity: 'warning',
          message: 'The required-by date is before the PO date.',
          fieldPath: 'po.requiredBy',
          ruleVersion: V,
        }
      : null;
  },
  (data) =>
    !nonEmpty(data.po?.requiredBy)
      ? {
          id: 'po.required_by_missing',
          severity: 'info',
          message: 'No delivery / required-by date set — vendors need a deadline.',
          fieldPath: 'po.requiredBy',
          ruleVersion: V,
        }
      : null,
  (data) =>
    data.po?.taxMode === 'none' &&
    (data.items ?? []).some((it) => (it?.taxRate ?? 0) > 0)
      ? {
          id: 'po.tax_ignored',
          severity: 'info',
          message: 'Tax mode is "none" — per-item tax rates will be ignored.',
          fieldPath: 'po.taxMode',
          ruleVersion: V,
        }
      : null,
];

export const purchaseOrderRisks: RisksFunction<Partial<PurchaseOrderData>> = (
  data,
) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
