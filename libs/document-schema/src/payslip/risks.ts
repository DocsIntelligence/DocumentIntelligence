import type { RisksFunction, Warning } from '../types';
import type { PayslipData } from './schema';

/** Deterministic risk rules for payslips (NOT LLM outputs). */

type Data = Partial<PayslipData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const sum = (arr?: { amount?: number }[]) =>
  (arr ?? []).reduce((s, c) => s + Number(c?.amount ?? 0), 0);
const V = '2026-06-13';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.employer?.name)
      ? null
      : {
          id: 'payslip.employer_missing',
          severity: 'error',
          message: 'The employer / company name is required.',
          fieldPath: 'employer.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.employee?.name)
      ? null
      : {
          id: 'payslip.employee_missing',
          severity: 'error',
          message: 'The employee name is required.',
          fieldPath: 'employee.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.payslip?.payPeriodLabel)
      ? null
      : {
          id: 'payslip.period_missing',
          severity: 'error',
          message: 'The pay period (e.g. "June 2026") is required.',
          fieldPath: 'payslip.payPeriodLabel',
          ruleVersion: V,
        },
  (data) => {
    const earnings = (data.earnings ?? []).filter(
      (e) => nonEmpty(e?.component) && (e?.amount ?? 0) > 0,
    );
    return earnings.length
      ? null
      : {
          id: 'payslip.earnings_missing',
          severity: 'warning',
          message: 'Add at least one earning component with an amount.',
          fieldPath: 'earnings',
          ruleVersion: V,
        };
  },
  (data) => {
    const gross = sum(data.earnings);
    const deductions = sum(data.deductions);
    return gross > 0 && deductions > gross
      ? {
          id: 'payslip.deductions_exceed_gross',
          severity: 'warning',
          message: 'Total deductions exceed gross earnings — net pay is negative.',
          fieldPath: 'deductions',
          ruleVersion: V,
        }
      : null;
  },
];

export const payslipRisks: RisksFunction<Partial<PayslipData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
