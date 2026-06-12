import type { RisksFunction, Warning } from '../types';
import type { NdaData } from './schema';

/**
 * Deterministic risk rules for NDAs (NOT LLM outputs). An NDA's enforceability
 * rests on the Indian Contract Act, 1872 generally; these rules flag the
 * commercial/legal gaps that make an NDA weak or unenforceable, not statutory
 * citations.
 */

type Data = Partial<NdaData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-12';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.partyA?.name)
      ? null
      : {
          id: 'nda.partyA_missing',
          severity: 'error',
          message: 'Party A’s name is required.',
          fieldPath: 'partyA.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.partyB?.name)
      ? null
      : {
          id: 'nda.partyB_missing',
          severity: 'error',
          message: 'Party B’s name is required.',
          fieldPath: 'partyB.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.agreement?.effectiveDate)
      ? null
      : {
          id: 'nda.effective_date_missing',
          severity: 'error',
          message: 'The effective date is required.',
          fieldPath: 'agreement.effectiveDate',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.agreement?.purpose)
      ? null
      : {
          id: 'nda.purpose_missing',
          severity: 'warning',
          message:
            'State the purpose. An NDA with no defined purpose is hard to enforce and reads as overbroad.',
          fieldPath: 'agreement.purpose',
          ruleVersion: V,
        },
  (data) => {
    const scope = data.terms?.confidentialScope?.filter((s) => nonEmpty(s)) ?? [];
    return scope.length
      ? null
      : {
          id: 'nda.scope_missing',
          severity: 'warning',
          message:
            'Describe what counts as Confidential Information. A blanket NDA covering "everything" is more easily challenged.',
          fieldPath: 'terms.confidentialScope',
          ruleVersion: V,
        };
  },
  (data) => {
    const yrs = data.terms?.survivalYears;
    if (yrs === undefined) return null;
    if (yrs === 0)
      return {
        id: 'nda.survival_perpetual',
        severity: 'info',
        message:
          'Confidentiality is set to survive indefinitely. Perpetual obligations are valid for trade secrets but may be read down for ordinary commercial information — consider a fixed period.',
        fieldPath: 'terms.survivalYears',
        ruleVersion: V,
      };
    if (yrs > 10)
      return {
        id: 'nda.survival_long',
        severity: 'info',
        message: `A ${yrs}-year survival period is unusually long; 2–5 years is typical for commercial NDAs.`,
        fieldPath: 'terms.survivalYears',
        ruleVersion: V,
      };
    return null;
  },
  (data) =>
    data.governing?.disputeResolution === 'arbitration' &&
    !nonEmpty(data.governing?.arbitrationSeat)
      ? {
          id: 'nda.arbitration_seat_missing',
          severity: 'warning',
          message:
            'Arbitration is selected but no seat is specified. State the seat/venue (Arbitration and Conciliation Act, 1996).',
          fieldPath: 'governing.arbitrationSeat',
          ruleVersion: V,
        }
      : null,
  (data) =>
    nonEmpty(data.governing?.state)
      ? null
      : {
          id: 'nda.governing_law_missing',
          severity: 'info',
          message: 'Specify the governing-law State and the courts with exclusive jurisdiction.',
          fieldPath: 'governing.state',
          ruleVersion: V,
        },
];

export const ndaRisks: RisksFunction<Partial<NdaData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
