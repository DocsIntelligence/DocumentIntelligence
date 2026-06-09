import type { RisksFunction, Warning } from '../types';
import type { AffidavitData } from './schema';

/**
 * Deterministic risk rules for affidavits (NOT LLM outputs). Each rule is a
 * pure function over the data.
 *
 * Citations policy: the punishable-false-affidavit warning is phrased
 * conceptually and does NOT hardcode a statutory section — the exact provision
 * (now under the Bharatiya Nyaya Sanhita, 2023, which replaced the IPC 1860)
 * must be resolved/verified via `@org/legal-reference`, never guessed here.
 * This is the golden rule: the system never authors a citation it hasn't
 * verified.
 */

type Rule = (data: Partial<AffidavitData>) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

const rules: Rule[] = [
  // Deponent name required.
  (data) => {
    if (!nonEmpty(data.deponent?.name)) {
      return {
        id: 'affidavit.deponent_name_missing',
        severity: 'error',
        message: 'Name the deponent — the person swearing this affidavit.',
        fieldPath: 'deponent.name',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Deponent address required.
  (data) => {
    if (!nonEmpty(data.deponent?.address)) {
      return {
        id: 'affidavit.deponent_address_missing',
        severity: 'warning',
        message:
          'Provide the deponent’s residential address — affidavits identify the deponent by name and address.',
        fieldPath: 'deponent.address',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // At least one real declaration.
  (data) => {
    const statements = (data.declaration?.statements ?? []).filter(nonEmpty);
    if (statements.length === 0) {
      return {
        id: 'affidavit.statements_empty',
        severity: 'error',
        message:
          'Add at least one declaration — the substance of what the deponent is affirming.',
        fieldPath: 'declaration.statements',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Age is conventionally stated in the opening.
  (data) => {
    if (data.deponent && data.deponent.age == null) {
      return {
        id: 'affidavit.age_missing',
        severity: 'info',
        message:
          'Affidavits conventionally state the deponent’s age ("aged about __ years"). Add it for completeness.',
        fieldPath: 'deponent.age',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Self-attested → may not be accepted where an affidavit is required.
  (data) => {
    if (data.attestation?.type === 'self_attested') {
      return {
        id: 'affidavit.self_attested',
        severity: 'warning',
        message:
          'An affidavit ordinarily must be sworn/affirmed before a Notary, Oath Commissioner, or other competent authority to carry evidentiary value. A self-attested declaration may be rejected where an affidavit is required.',
        fieldPath: 'attestation.type',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Standing reminder: a false affidavit is punishable (conceptual, no section).
  (data) => {
    const statements = (data.declaration?.statements ?? []).filter(nonEmpty);
    if (statements.length > 0) {
      return {
        id: 'affidavit.truthfulness',
        severity: 'info',
        message:
          'Every statement must be true to the deponent’s knowledge — a false affidavit is a punishable offence (giving false evidence / a false statement in a declaration). Verify the applicable provision against the current law.',
        fieldPath: 'declaration.statements',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
];

export const affidavitRisks: RisksFunction<Partial<AffidavitData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
