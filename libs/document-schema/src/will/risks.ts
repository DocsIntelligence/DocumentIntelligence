import type { RisksFunction, Warning } from '../types';
import type { WillData } from './schema';

/** Deterministic risk rules for wills (NOT LLM outputs). */

type Data = Partial<WillData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-13';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.testator?.name)
      ? null
      : {
          id: 'will.testator_missing',
          severity: 'error',
          message: 'The testator’s full name is required.',
          fieldPath: 'testator.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.executor?.name)
      ? null
      : {
          id: 'will.executor_missing',
          severity: 'warning',
          message: 'Name an executor to administer the estate.',
          fieldPath: 'executor.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.will?.date)
      ? null
      : {
          id: 'will.date_missing',
          severity: 'error',
          message: 'The date of the will is required.',
          fieldPath: 'will.date',
          ruleVersion: V,
        },
  (data) => {
    const bequests = (data.bequests ?? []).filter(
      (b) => nonEmpty(b?.beneficiary) && nonEmpty(b?.description),
    );
    return bequests.length
      ? null
      : {
          id: 'will.bequests_missing',
          severity: 'warning',
          message: 'Add at least one bequest (who gets what).',
          fieldPath: 'bequests',
          ruleVersion: V,
        };
  },
  (data) => {
    const witnesses = (data.witnesses ?? []).filter((w) => nonEmpty(w?.name));
    return witnesses.length >= 2
      ? null
      : {
          id: 'will.witnesses_required',
          severity: 'error',
          message:
            'A will must be attested by at least TWO witnesses (Indian Succession Act, 1925, §63).',
          fieldPath: 'witnesses',
          ruleVersion: V,
        };
  },
  (data) =>
    !nonEmpty(data.wishes?.residuaryBeneficiary)
      ? {
          id: 'will.residue_missing',
          severity: 'info',
          message:
            'Name a residuary beneficiary for anything not specifically bequeathed — avoids partial intestacy.',
          fieldPath: 'wishes.residuaryBeneficiary',
          ruleVersion: V,
        }
      : null,
  () => ({
    id: 'will.esign_excluded',
    severity: 'info',
    message:
      'A will cannot be signed electronically (Schedule 1, IT Act 2000). Print it and sign by hand before two witnesses.',
    ruleVersion: V,
  }),
];

export const willRisks: RisksFunction<Partial<WillData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
