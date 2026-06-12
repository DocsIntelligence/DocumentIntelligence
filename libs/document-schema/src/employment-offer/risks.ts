import type { RisksFunction, Warning } from '../types';
import type { EmploymentOfferData } from './schema';

/** Deterministic risk rules for employment offer letters (NOT LLM outputs). */

type Data = Partial<EmploymentOfferData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-12';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.company?.name)
      ? null
      : {
          id: 'offer.company_missing',
          severity: 'error',
          message: 'The company name is required.',
          fieldPath: 'company.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.candidate?.name)
      ? null
      : {
          id: 'offer.candidate_missing',
          severity: 'error',
          message: 'The candidate name is required.',
          fieldPath: 'candidate.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.role?.title)
      ? null
      : {
          id: 'offer.title_missing',
          severity: 'error',
          message: 'The job title is required.',
          fieldPath: 'role.title',
          ruleVersion: V,
        },
  (data) =>
    data.compensation?.annualCtc && data.compensation.annualCtc > 0
      ? null
      : {
          id: 'offer.ctc_missing',
          severity: 'warning',
          message: 'Specify the compensation amount.',
          fieldPath: 'compensation.annualCtc',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.role?.startDate)
      ? null
      : {
          id: 'offer.start_date_missing',
          severity: 'info',
          message: 'Add a start date so the offer is unambiguous.',
          fieldPath: 'role.startDate',
          ruleVersion: V,
        },
  (data) =>
    data.terms?.atWill && data.compensation?.currency === 'INR'
      ? {
          id: 'offer.at_will_india',
          severity: 'warning',
          message:
            'At-will employment is selected with INR compensation. Indian employment is generally NOT at-will — turn this off for an India-based role.',
          fieldPath: 'terms.atWill',
          ruleVersion: V,
        }
      : null,
];

export const employmentOfferRisks: RisksFunction<
  Partial<EmploymentOfferData>
> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
