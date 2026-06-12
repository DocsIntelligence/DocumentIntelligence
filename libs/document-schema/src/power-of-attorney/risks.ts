import type { RisksFunction, Warning } from '../types';
import type { PowerOfAttorneyData } from './schema';

/** Deterministic risk rules for a Power of Attorney (NOT LLM outputs). */

type Data = Partial<PowerOfAttorneyData>;
type Rule = (data: Data) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;
const V = '2026-06-12';

const rules: Rule[] = [
  (data) =>
    nonEmpty(data.principal?.name)
      ? null
      : {
          id: 'poa.principal_missing',
          severity: 'error',
          message: 'The principal (grantor) name is required.',
          fieldPath: 'principal.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.attorney?.name)
      ? null
      : {
          id: 'poa.attorney_missing',
          severity: 'error',
          message: 'The attorney (agent) name is required.',
          fieldPath: 'attorney.name',
          ruleVersion: V,
        },
  (data) =>
    nonEmpty(data.poa?.executionDate)
      ? null
      : {
          id: 'poa.date_missing',
          severity: 'error',
          message: 'The date of execution is required.',
          fieldPath: 'poa.executionDate',
          ruleVersion: V,
        },
  (data) => {
    const powers = data.powers?.filter((p) => nonEmpty(p)) ?? [];
    return powers.length
      ? null
      : {
          id: 'poa.powers_missing',
          severity: 'warning',
          message:
            'List the specific powers granted. A PoA with vague or no powers is open to misuse and may be refused by registrars/banks.',
          fieldPath: 'powers',
          ruleVersion: V,
        };
  },
  (data) =>
    data.terms?.durationType === 'fixed' && !nonEmpty(data.terms?.expiryDate)
      ? {
          id: 'poa.expiry_missing',
          severity: 'warning',
          message: 'A fixed duration is selected but no expiry date is set.',
          fieldPath: 'terms.expiryDate',
          ruleVersion: V,
        }
      : null,
  (data) =>
    !data.poa?.registered
      ? {
          id: 'poa.registration',
          severity: 'info',
          message:
            'A PoA dealing with immovable property generally must be registered (Registration Act, 1908) and adequately stamped. Confirm State requirements.',
          fieldPath: 'poa.registered',
          ruleVersion: V,
        }
      : null,
  () => ({
    id: 'poa.esign_excluded',
    severity: 'info',
    message:
      'A Power of Attorney cannot be validly signed electronically (IT Act, 2000, Schedule 1). Execute on paper, before witnesses, and notarise/register as required.',
    ruleVersion: V,
  }),
];

export const powerOfAttorneyRisks: RisksFunction<
  Partial<PowerOfAttorneyData>
> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
