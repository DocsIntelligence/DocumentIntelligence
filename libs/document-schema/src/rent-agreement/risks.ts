import type { RisksFunction, Warning } from '../types';
import type { RentAgreementData } from './schema';

/**
 * Deterministic risk rules for rent agreements. These are NOT LLM outputs.
 * Each rule:
 *   - is a pure function over (data) → optional Warning
 *   - declares an effective-date `ruleVersion` so we can audit drift later
 *   - cites a specific statute/section where applicable, in the message
 *
 * High-priority rules cover registration thresholds, deposit caps,
 * notice-period sanity, and missing essentials (witnesses, parties).
 *
 * Sources cross-checked when authoring (operator should re-verify quarterly):
 *   - Registration Act 1908, §17 (compulsory registration for leases > 11mo)
 *   - Maharashtra Rent Control Act, Bombay Stamp Act
 *   - Karnataka Rent Act / Model Tenancy Act 2021 (adopted in some states)
 *   - Transfer of Property Act 1882 §105–§111
 */

type Rule = (data: Partial<RentAgreementData>) => Warning | null;

const rules: Rule[] = [
  // ─── Registration thresholds ────────────────────────────────────────
  (data) => {
    if (data.term?.durationMonths == null) return null;
    if (data.term.durationMonths > 11 && !data.registered) {
      return {
        id: 'registration.duration_gt_11_unregistered',
        severity: 'error',
        message:
          'Leases for more than 11 months must be registered (Registration Act 1908 §17). Either shorten to ≤ 11 months or mark as registered.',
        fieldPath: 'term.durationMonths',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Maharashtra: registration mandatory regardless of duration if
  // residential rent agreement (Bombay Rent Control / state law).
  (data) => {
    if (
      data.state === 'IN-MH' &&
      data.property?.type !== 'commercial' &&
      data.registered === false
    ) {
      return {
        id: 'mh.residential_registration',
        severity: 'warning',
        message:
          'Maharashtra requires registration of residential rent agreements regardless of duration. Consider toggling “Registered”.',
        fieldPath: 'registered',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Karnataka: deposit cap of 10 months rent (commonly enforced).
  (data) => {
    if (data.state !== 'IN-KA') return null;
    const rent = data.rent_deposit?.rentMonthly;
    const deposit = data.rent_deposit?.depositAmount;
    if (!rent || !deposit) return null;
    if (deposit > 10 * rent) {
      return {
        id: 'ka.deposit_cap',
        severity: 'warning',
        message:
          'Karnataka conventionally caps security deposit at 10 months’ rent. Tenant may dispute deposits above this.',
        fieldPath: 'rent_deposit.depositAmount',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Model Tenancy Act 2021 — adopted in states like AP, TN, UP, etc.
  // Caps residential deposit at 2 months rent.
  (data) => {
    const mtaStates = new Set(['IN-AP', 'IN-TN', 'IN-UP', 'IN-AS']);
    if (!data.state || !mtaStates.has(data.state)) return null;
    if (data.property?.type === 'commercial') return null;
    const rent = data.rent_deposit?.rentMonthly;
    const deposit = data.rent_deposit?.depositAmount;
    if (!rent || !deposit) return null;
    if (deposit > 2 * rent) {
      return {
        id: 'mta.residential_deposit_cap',
        severity: 'error',
        message:
          'Model Tenancy Act 2021 caps residential security deposit at 2 months’ rent. This state has adopted MTA.',
        fieldPath: 'rent_deposit.depositAmount',
        ruleVersion: '2021-06-02',
      };
    }
    return null;
  },

  // ─── Notice period sanity ──────────────────────────────────────────
  (data) => {
    const n = data.term?.noticePeriodDays;
    if (n == null) return null;
    if (n < 15) {
      return {
        id: 'term.notice_short',
        severity: 'warning',
        message:
          'Notice periods below 15 days are unusual and may be unenforceable. Consider ≥ 30 days.',
        fieldPath: 'term.noticePeriodDays',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // ─── Lock-in vs duration ───────────────────────────────────────────
  (data) => {
    const lock = data.term?.lockInMonths;
    const dur = data.term?.durationMonths;
    if (lock == null || dur == null) return null;
    if (lock > dur) {
      return {
        id: 'term.lockin_exceeds_duration',
        severity: 'error',
        message:
          'Lock-in cannot exceed the agreement duration. Reduce lock-in or extend duration.',
        fieldPath: 'term.lockInMonths',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // ─── Essentials present ────────────────────────────────────────────
  (data) => {
    if (!data.parties?.landlord?.name) {
      return {
        id: 'parties.landlord_missing',
        severity: 'error',
        message: 'Landlord name is required.',
        fieldPath: 'parties.landlord.name',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
  (data) => {
    if (!data.parties?.tenant?.name) {
      return {
        id: 'parties.tenant_missing',
        severity: 'error',
        message: 'Tenant name is required.',
        fieldPath: 'parties.tenant.name',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
  (data) => {
    if (!data.witnesses || data.witnesses.length < 2) {
      return {
        id: 'witnesses.min_two',
        severity: 'warning',
        message:
          'Two witnesses are conventional for executed rent agreements; many sub-registrar offices require them.',
        fieldPath: 'witnesses',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // ─── Late fee sanity ───────────────────────────────────────────────
  (data) => {
    const rent = data.rent_deposit?.rentMonthly;
    const late = data.rent_deposit?.lateFeePerDay;
    if (!rent || !late) return null;
    // Late fee per day exceeding ~1% of rent per day is punitive.
    if (late > rent * 0.01) {
      return {
        id: 'rent.late_fee_punitive',
        severity: 'warning',
        message:
          'Late fee per day exceeds ~1% of monthly rent. Courts may treat this as a penalty rather than liquidated damages.',
        fieldPath: 'rent_deposit.lateFeePerDay',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
];

export const rentAgreementRisks: RisksFunction<Partial<RentAgreementData>> = (
  data,
) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
