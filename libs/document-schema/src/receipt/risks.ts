import type { RisksFunction, Warning } from '../types';
import type { ReceiptData } from './schema';

/** Deterministic risk rules for payment receipts (NOT LLM outputs). */

type Data = Partial<ReceiptData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-13';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.payee?.name)
      ? null
      : {
          id: 'receipt.payee_missing',
          severity: 'error',
          message: 'The issuer (received by) name is required.',
          fieldPath: 'payee.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.payer?.name)
      ? null
      : {
          id: 'receipt.payer_missing',
          severity: 'error',
          message: 'The payer (received from) name is required.',
          fieldPath: 'payer.name',
          ruleVersion: V,
        },
  (data) =>
    data.payment?.amount && data.payment.amount > 0
      ? null
      : {
          id: 'receipt.amount_missing',
          severity: 'error',
          message: 'An amount greater than zero is required.',
          fieldPath: 'payment.amount',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.payment?.towards)
      ? null
      : {
          id: 'receipt.towards_missing',
          severity: 'warning',
          message: 'State what the payment was received towards.',
          fieldPath: 'payment.towards',
          ruleVersion: V,
        },
  (data) =>
    data.payment?.mode &&
    data.payment.mode !== 'cash' &&
    !nonEmpty(data.payment?.reference)
      ? {
          id: 'receipt.reference_missing',
          severity: 'info',
          message:
            'Add a reference (cheque no. / UPI txn / NEFT ref) for non-cash payments.',
          fieldPath: 'payment.reference',
          ruleVersion: V,
        }
      : null,
  (data) => {
    if (!data.payment?.isPartPayment) return null;
    const total = data.payment?.totalAmount ?? 0;
    const paid = data.payment?.amount ?? 0;
    return total <= 0
      ? {
          id: 'receipt.total_missing',
          severity: 'warning',
          message: 'Part payment marked — set the total amount due to show the balance.',
          fieldPath: 'payment.totalAmount',
          ruleVersion: V,
        }
      : total < paid
        ? {
            id: 'receipt.total_lt_paid',
            severity: 'warning',
            message: 'The total due is less than the amount received.',
            fieldPath: 'payment.totalAmount',
            ruleVersion: V,
          }
        : null;
  },
];

export const receiptRisks: RisksFunction<Partial<ReceiptData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
