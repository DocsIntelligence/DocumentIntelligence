import type { RisksFunction, Warning } from '../types';
import type { PromissoryNoteData } from './schema';

/**
 * Deterministic risk rules for promissory notes (NOT LLM outputs). The two
 * legal landmines are stamping (admissibility) and electronic signature
 * (Schedule-1 exclusion) — surfaced here so the user is warned before relying
 * on the instrument.
 */

type Data = Partial<PromissoryNoteData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-12';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.maker?.name)
      ? null
      : {
          id: 'pronote.maker_missing',
          severity: 'error',
          message: 'The maker (promisor) name is required.',
          fieldPath: 'maker.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.payee?.name)
      ? null
      : {
          id: 'pronote.payee_missing',
          severity: 'error',
          message: 'The payee name is required.',
          fieldPath: 'payee.name',
          ruleVersion: V,
        },
  (data) =>
    data.note?.principalAmount && data.note.principalAmount > 0
      ? null
      : {
          id: 'pronote.amount_missing',
          severity: 'error',
          message: 'A principal amount greater than zero is required.',
          fieldPath: 'note.principalAmount',
          ruleVersion: V,
        },
  (data) =>
    data.note?.payableOn === 'fixed_date' && !nonEmpty(data.note?.dueDate)
      ? {
          id: 'pronote.due_date_missing',
          severity: 'warning',
          message: 'A fixed payable date is selected but no due date is set.',
          fieldPath: 'note.dueDate',
          ruleVersion: V,
        }
      : null,
  (data) => {
    const rate = data.note?.interestRate;
    return rate !== undefined && rate > 24
      ? {
          id: 'pronote.interest_high',
          severity: 'info',
          message: `Interest of ${rate}% p.a. is high; rates above ~24% may be challenged as excessive under State money-lending / usury laws.`,
          fieldPath: 'note.interestRate',
          ruleVersion: V,
        }
      : null;
  },
  (data) =>
    data.note?.onStampPaper
      ? null
      : {
          id: 'pronote.stamp_required',
          severity: 'warning',
          message:
            'A promissory note must bear the requisite stamp under the Indian Stamp Act. An unstamped or insufficiently stamped note is inadmissible in evidence.',
          fieldPath: 'note.onStampPaper',
          ruleVersion: V,
        },
  () => ({
    id: 'pronote.esign_excluded',
    severity: 'info',
    message:
      'A promissory note cannot be validly signed electronically (IT Act, 2000, Schedule 1 excludes negotiable instruments other than cheques). Print and sign by hand.',
    ruleVersion: V,
  }),
];

export const promissoryNoteRisks: RisksFunction<Partial<PromissoryNoteData>> = (
  data,
) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
