import type { CSSProperties } from 'react';

/**
 * Shared computation for invoice-family documents (invoice, quotation, purchase
 * order, credit/debit note). Totals are derived from line items so they can
 * never drift from inputs. Handles tax-exclusive/inclusive pricing, per-line
 * discount, a proportional invoice-level discount, and GST/single/none tax with
 * intra- vs inter-state splitting.
 */

export interface LineItemInput {
  description?: string;
  hsnSac?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  discountPct?: number;
  taxRate?: number;
}

export interface ComputeInput {
  taxMode?: 'gst' | 'single' | 'none';
  inclusive?: boolean;
  items?: LineItemInput[];
  sellerState?: string;
  supplyState?: string;
  additionalDiscount?: number;
  shipping?: number;
  roundOff?: boolean;
  amountPaid?: number;
}

export interface ComputedLine {
  item: LineItemInput;
  taxable: number;
  taxRate: number;
  tax: number;
  total: number;
}

export interface RateGroup {
  rate: number;
  taxable: number;
  tax: number;
}

export interface ComputeResult {
  taxMode: 'gst' | 'single' | 'none';
  lines: ComputedLine[];
  groups: RateGroup[];
  interState: boolean;
  itemsTaxable: number;
  appliedDiscount: number;
  taxableAfter: number;
  taxAfter: number;
  shipping: number;
  roundOffAmt: number;
  grand: number;
  amountPaid: number;
  balanceDue: number;
}

export function computeInvoice(input: ComputeInput): ComputeResult {
  const taxMode = input.taxMode ?? 'gst';
  const inclusive = input.inclusive === true;
  const items = (input.items ?? []).filter(
    (it) => it && (it.description?.trim() || (it.quantity ?? 0) > 0),
  );

  const lines: ComputedLine[] = items.map((item) => {
    const qty = Number(item.quantity ?? 0);
    const rate = Number(item.rate ?? 0);
    const disc = Number(item.discountPct ?? 0);
    const taxRate = taxMode === 'none' ? 0 : Number(item.taxRate ?? 0);
    const afterDisc = qty * rate * (1 - disc / 100);
    let taxable: number;
    let tax: number;
    if (inclusive && taxRate > 0) {
      taxable = afterDisc / (1 + taxRate / 100);
      tax = afterDisc - taxable;
    } else {
      taxable = afterDisc;
      tax = taxable * (taxRate / 100);
    }
    return { item, taxable, taxRate, tax, total: taxable + tax };
  });

  const itemsTaxable = lines.reduce((s, l) => s + l.taxable, 0);
  const itemsTax = lines.reduce((s, l) => s + l.tax, 0);

  const addlDiscount = Number(input.additionalDiscount ?? 0);
  const factor =
    addlDiscount > 0 && itemsTaxable > 0
      ? Math.max(0, 1 - addlDiscount / itemsTaxable)
      : 1;
  const appliedDiscount = itemsTaxable - itemsTaxable * factor;
  const taxableAfter = itemsTaxable * factor;
  const taxAfter = itemsTax * factor;

  const groupMap = new Map<number, RateGroup>();
  for (const l of lines) {
    const g = groupMap.get(l.taxRate) ?? { rate: l.taxRate, taxable: 0, tax: 0 };
    g.taxable += l.taxable * factor;
    g.tax += l.tax * factor;
    groupMap.set(l.taxRate, g);
  }
  const groups = [...groupMap.values()]
    .filter((g) => g.rate > 0)
    .sort((a, b) => a.rate - b.rate);

  const sellerState = input.sellerState?.trim().toLowerCase();
  const supplyState = input.supplyState?.trim().toLowerCase();
  const interState =
    !!sellerState && !!supplyState && sellerState !== supplyState;

  const shipping = Number(input.shipping ?? 0);
  const preRound = taxableAfter + taxAfter + shipping;
  const roundOff = input.roundOff !== false;
  const grand = roundOff ? Math.round(preRound) : preRound;
  const roundOffAmt = grand - preRound;
  const amountPaid = Number(input.amountPaid ?? 0);
  const balanceDue = grand - amountPaid;

  return {
    taxMode,
    lines,
    groups,
    interState,
    itemsTaxable,
    appliedDiscount,
    taxableAfter,
    taxAfter,
    shipping,
    roundOffAmt,
    grand,
    amountPaid,
    balanceDue,
  };
}

/** Currency formatter for any ISO currency (2 decimals). */
export function makeMoney(currency = 'INR') {
  const fmt = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (n: number) => fmt.format(Number.isFinite(n) ? n : 0);
}

// Shared table cell styles for invoice-family tables.
export const cellH: CSSProperties = {
  border: '1px solid #ccc',
  padding: '4pt 6pt',
  textAlign: 'right',
  background: '#f3f4f6',
  fontSize: '9.5pt',
};
export const cell: CSSProperties = {
  border: '1px solid #ccc',
  padding: '4pt 6pt',
  textAlign: 'center',
  fontSize: '9.5pt',
};
export const cellR: CSSProperties = { ...cell, textAlign: 'right' };
export const totLbl: CSSProperties = {
  padding: '2pt 6pt',
  textAlign: 'right',
  color: '#444',
};
export const totVal: CSSProperties = {
  padding: '2pt 6pt',
  textAlign: 'right',
  width: '40%',
};
