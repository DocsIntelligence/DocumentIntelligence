import type { RisksFunction, Warning } from '../types';
import type { ChequeBounceNoticeData } from './schema';

/**
 * Deterministic §138 / §142 NI Act risk rules (NOT LLM outputs). These guard
 * the statutory timeline that makes or breaks a cheque-bounce prosecution:
 *
 *   proviso (b) §138 — demand within 30 days of the bank return memo;
 *   proviso (c) §138 — drawer gets ≥15 days from receipt to pay;
 *   §138 — the cheque must discharge a legally enforceable debt/liability;
 *   §141 — name the officers in charge when the drawer is a company;
 *   §142 — complaint within one month of the cause of action (lapse of the
 *          15-day payment window). Surfaced as guidance (it post-dates the notice).
 *
 * Cheque validity is 3 months (RBI) — a cheque presented stale and returned
 * "stale"/"out of date" does not attract §138.
 */

const RULE_VERSION = '2026-06-19';
const DAY_MS = 86_400_000;
const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

const daysBetween = (from?: string, to?: string): number | null => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
};

type Rule = (data: Partial<ChequeBounceNoticeData>) => Warning | null;

const rules: Rule[] = [
  // ── Parties ─────────────────────────────────────────────────────────────
  (d) =>
    nonEmpty(d.payee?.name)
      ? null
      : {
          id: 'cheque.payee_missing',
          severity: 'error',
          message: 'The payee (client) name is required.',
          fieldPath: 'payee.name',
          ruleVersion: RULE_VERSION,
        },
  (d) =>
    nonEmpty(d.drawer?.name)
      ? null
      : {
          id: 'cheque.drawer_missing',
          severity: 'error',
          message: 'The drawer (noticee) name is required.',
          fieldPath: 'drawer.name',
          ruleVersion: RULE_VERSION,
        },
  (d) =>
    nonEmpty(d.drawer?.address)
      ? null
      : {
          id: 'cheque.drawer_address_missing',
          severity: 'warning',
          message:
            'A serviceable address for the drawer is essential — service of the notice is what starts the 15-day payment clock.',
          fieldPath: 'drawer.address',
          ruleVersion: RULE_VERSION,
        },

  // §141 — company drawer: name the officers in charge.
  (d) => {
    if (!d.drawer?.isCompany) return null;
    const officers = (d.drawer.officers ?? []).filter(nonEmpty);
    if (officers.length === 0) {
      return {
        id: 'cheque.company_officers_missing',
        severity: 'warning',
        message:
          'The drawer is a company/firm: name the persons in charge of its business so they are put to notice and made liable under NI Act §141.',
        fieldPath: 'drawer.officers',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },

  // ── Cheque particulars ──────────────────────────────────────────────────
  (d) =>
    nonEmpty(d.cheque?.number) && !!d.cheque?.amount
      ? null
      : {
          id: 'cheque.particulars_missing',
          severity: 'error',
          message:
            'The cheque number and amount are mandatory for a §138 notice.',
          fieldPath: 'cheque.number',
          ruleVersion: RULE_VERSION,
        },
  (d) =>
    nonEmpty(d.cheque?.dishonourReason)
      ? null
      : {
          id: 'cheque.dishonour_reason_missing',
          severity: 'warning',
          message:
            'State the reason on the bank’s return memo (e.g. "Funds insufficient" / "Exceeds arrangement").',
          fieldPath: 'cheque.dishonourReason',
          ruleVersion: RULE_VERSION,
        },

  // Cheque validity (3 months) — a stale-cheque return doesn't attract §138.
  (d) => {
    const span = daysBetween(d.cheque?.chequeDate, d.cheque?.presentedDate);
    if (span != null && span > 90) {
      return {
        id: 'cheque.presented_stale',
        severity: 'warning',
        message:
          'The cheque appears to have been presented more than 3 months after its date. A cheque returned because it was stale/out-of-date does not attract §138 — confirm it was presented within validity.',
        fieldPath: 'cheque.presentedDate',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },

  // ── §138 proviso (b): demand within 30 days of the return memo ───────────
  (d) => {
    const span = daysBetween(d.cheque?.dishonourDate, d.noticeDate);
    if (span != null && span > 30) {
      return {
        id: 'cheque.demand_window_lapsed',
        severity: 'error',
        message:
          'This demand is dated more than 30 days after the cheque-return memo. The §138 demand must be made within 30 days of the dishonour intimation (proviso (b)) — the cause of action may be lost.',
        fieldPath: 'noticeDate',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },

  // ── §138 proviso (c): ≥15 days to pay ────────────────────────────────────
  (d) => {
    const days = d.complianceDays;
    if (days != null && days < 15) {
      return {
        id: 'cheque.payment_window_short',
        severity: 'error',
        message:
          'The drawer must be given at least 15 days from receipt to pay (proviso (c) to §138). Set "days to pay" to 15 or more.',
        fieldPath: 'complianceDays',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },

  // ── §138: legally enforceable debt/liability ─────────────────────────────
  (d) =>
    nonEmpty(d.underlyingLiability)
      ? null
      : {
          id: 'cheque.liability_missing',
          severity: 'error',
          message:
            'State the legally enforceable debt or liability the cheque was issued towards — §138 applies only to such cheques.',
          fieldPath: 'underlyingLiability',
          ruleVersion: RULE_VERSION,
        },

  // Demand amount should not be below the cheque amount.
  (d) => {
    const cheque = d.cheque?.amount;
    const demand = d.demandAmount;
    if (cheque != null && demand != null && demand < cheque) {
      return {
        id: 'cheque.demand_below_cheque',
        severity: 'warning',
        message:
          'The amount demanded is less than the dishonoured cheque amount. The demand should be for at least the cheque amount.',
        fieldPath: 'demandAmount',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },

  // §142 guidance — complaint window (post-dates the notice; info only).
  (d) => {
    if (!d.noticeDate || d.complianceDays == null) return null;
    return {
      id: 'cheque.complaint_window_info',
      severity: 'info',
      message:
        'If the drawer does not pay within the notice period, a complaint under §138 must be filed within one month of the cause of action arising (i.e. lapse of the payment window) — §142.',
      fieldPath: 'complianceDays',
      ruleVersion: RULE_VERSION,
    };
  },
];

export const chequeBounceNoticeRisks: RisksFunction<
  Partial<ChequeBounceNoticeData>
> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
