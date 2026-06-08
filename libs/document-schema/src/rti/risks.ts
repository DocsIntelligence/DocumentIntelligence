import type { RisksFunction, Warning } from '../types';
import type { RtiApplicationData } from './schema';

/**
 * Deterministic risk rules for RTI applications (NOT LLM outputs). Each rule is
 * a pure function over the data; statutory references are author-verified.
 *
 * Anchors: RTI Act 2005 §6(1), §6(3), §7(1) + proviso, §7(5) proviso, §19.
 */

type Rule = (data: Partial<RtiApplicationData>) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

const rules: Rule[] = [
  // Public authority required.
  (data) => {
    if (!nonEmpty(data.authority?.publicAuthority)) {
      return {
        id: 'rti.authority_missing',
        severity: 'error',
        message:
          'Name the public authority that holds the information — the application must be addressed to its Public Information Officer (§6(1)).',
        fieldPath: 'authority.publicAuthority',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // At least one real question.
  (data) => {
    const qs = (data.request?.questions ?? []).filter(nonEmpty);
    if (qs.length === 0) {
      return {
        id: 'rti.questions_empty',
        severity: 'error',
        message: 'Add at least one specific information point you are seeking.',
        fieldPath: 'request.questions',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Applicant address needed for the reply.
  (data) => {
    if (!nonEmpty(data.applicant?.address)) {
      return {
        id: 'rti.applicant_address_missing',
        severity: 'warning',
        message:
          'Provide an address for reply — the PIO sends the information there.',
        fieldPath: 'applicant.address',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Fee: non-BPL applicants normally pay the prescribed fee (₹10 Central).
  (data) => {
    if (data.applicant?.isBPL) return null;
    const amt = data.fee?.amount;
    if (amt != null && amt === 0) {
      return {
        id: 'rti.fee_zero_non_bpl',
        severity: 'warning',
        message:
          'Non-BPL applicants must pay the prescribed application fee (₹10 for Central public authorities; state fees vary). Only BPL applicants are exempt (proviso to §7(5)).',
        fieldPath: 'fee.amount',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Life/liberty → 48-hour timeline (informational).
  (data) => {
    if (data.request?.lifeOrLiberty) {
      return {
        id: 'rti.life_liberty_48h',
        severity: 'info',
        message:
          'This concerns the life or liberty of a person — the information must be provided within 48 hours (proviso to §7(1)). State this clearly in the application.',
        fieldPath: 'request.lifeOrLiberty',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Too many points → PIO may treat as multiple applications.
  (data) => {
    const qs = (data.request?.questions ?? []).filter(nonEmpty);
    if (qs.length > 12) {
      return {
        id: 'rti.too_many_points',
        severity: 'info',
        message:
          'Very long requests are sometimes treated as multiple applications or refused as voluminous. Consider splitting or focusing the points.',
        fieldPath: 'request.questions',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
];

export const rtiRisks: RisksFunction<Partial<RtiApplicationData>> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
