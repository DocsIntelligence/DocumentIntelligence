import type { RisksFunction, Warning } from '../types';
import {
  CPA_DISTRICT_MAX,
  CPA_STATE_MAX,
  recommendedForum,
  type ConsumerComplaintData,
} from './schema';

/**
 * Deterministic Consumer Protection Act, 2019 risk rules (NOT LLM outputs).
 * These guard the gates that get a consumer complaint thrown out at the
 * threshold:
 *
 *   pecuniary jurisdiction — fixed by the CONSIDERATION PAID, not the relief
 *     claimed (2021 Rules): District ≤ ₹50L · State ₹50L–₹2cr · National > ₹2cr;
 *   §69 — complaint within 2 years of the cause of action (condonable);
 *   §2(7) — a "consumer" does not buy for resale / commercial purpose;
 *   §34(2) — territorial jurisdiction needs a serviceable OP address / a stated
 *     place where the cause of action arose;
 *   §39 — a complaint must pray for specific reliefs the Commission can grant.
 */

const RULE_VERSION = '2026-06-19';
const DAY_MS = 86_400_000;
const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

const FORUM_LABEL: Record<string, string> = {
  district: 'District Commission',
  state: 'State Commission',
  national: 'National Commission',
};

const daysBetween = (from?: string, to?: string): number | null => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
};

type Rule = (data: Partial<ConsumerComplaintData>) => Warning | null;

const rules: Rule[] = [
  // ── Parties ─────────────────────────────────────────────────────────────
  (d) =>
    nonEmpty(d.complainant?.name)
      ? null
      : {
          id: 'consumer.complainant_missing',
          severity: 'error',
          message: 'The complainant name is required.',
          fieldPath: 'complainant.name',
          ruleVersion: RULE_VERSION,
        },
  (d) => {
    const ops = (d.oppositeParties ?? []).filter((o) => nonEmpty(o?.name));
    return ops.length > 0
      ? null
      : {
          id: 'consumer.opposite_party_missing',
          severity: 'error',
          message: 'Name at least one opposite party against whom relief is sought.',
          fieldPath: 'oppositeParties',
          ruleVersion: RULE_VERSION,
        };
  },
  // §34(2) territorial jurisdiction — at least one OP needs a serviceable address.
  (d) => {
    const ops = d.oppositeParties ?? [];
    if (ops.length === 0) return null;
    const anyAddress = ops.some((o) => nonEmpty(o?.address));
    return anyAddress
      ? null
      : {
          id: 'consumer.op_address_missing',
          severity: 'warning',
          message:
            'No opposite-party address is given. Territorial jurisdiction (§34(2)) needs the place where an opposite party resides / carries on business, or where the cause of action arose.',
          fieldPath: 'oppositeParties',
          ruleVersion: RULE_VERSION,
        };
  },

  // ── Transaction / consideration ─────────────────────────────────────────
  (d) =>
    nonEmpty(d.transaction?.description)
      ? null
      : {
          id: 'consumer.transaction_missing',
          severity: 'error',
          message:
            'Describe the goods bought or service availed — the complaint must identify the transaction.',
          fieldPath: 'transaction.description',
          ruleVersion: RULE_VERSION,
        },
  (d) =>
    d.transaction?.considerationPaid != null &&
    d.transaction.considerationPaid > 0
      ? null
      : {
          id: 'consumer.consideration_missing',
          severity: 'error',
          message:
            'State the consideration paid — it fixes which Commission has pecuniary jurisdiction.',
          fieldPath: 'transaction.considerationPaid',
          ruleVersion: RULE_VERSION,
        },

  // ── Pecuniary jurisdiction (2021 Rules, keyed on consideration paid) ─────
  (d) => {
    const paid = d.transaction?.considerationPaid;
    const chosen = d.forum;
    if (paid == null || paid <= 0 || !chosen) return null;
    const rec = recommendedForum(paid);
    if (rec && rec !== chosen) {
      return {
        id: 'consumer.pecuniary_mismatch',
        severity: 'error',
        message: `The consideration paid (₹${paid.toLocaleString(
          'en-IN',
        )}) falls within the ${FORUM_LABEL[rec]}'s pecuniary jurisdiction, but this complaint names the ${FORUM_LABEL[chosen]}. Per the 2021 Rules: District ≤ ₹50 lakh, State ₹50 lakh–₹2 crore, National above ₹2 crore (by consideration paid).`,
        fieldPath: 'forum',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },
  // Boundary nudge: exactly at a threshold is a common trap.
  (d) => {
    const paid = d.transaction?.considerationPaid;
    if (paid == null) return null;
    if (paid === CPA_DISTRICT_MAX || paid === CPA_STATE_MAX) {
      return {
        id: 'consumer.pecuniary_boundary',
        severity: 'info',
        message:
          'The consideration sits exactly on a jurisdictional boundary (₹50 lakh / ₹2 crore). District ≤ ₹50 lakh and State ≤ ₹2 crore are inclusive of the cap — confirm the forum.',
        fieldPath: 'transaction.considerationPaid',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },

  // ── §69 limitation: file within 2 years of the cause of action ───────────
  (d) => {
    const span = daysBetween(d.causeOfActionDate, d.complaintDate);
    if (span != null && span > 730) {
      return {
        id: 'consumer.limitation_lapsed',
        severity: 'error',
        message:
          'This complaint is dated more than 2 years after the cause of action. Under §69 it cannot be admitted unless the delay is condoned for sufficient cause — plead and prove condonation, or it is barred by limitation.',
        fieldPath: 'causeOfActionDate',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },
  (d) =>
    nonEmpty(d.causeOfActionDate)
      ? null
      : {
          id: 'consumer.cause_date_missing',
          severity: 'warning',
          message:
            'State when the cause of action arose so the 2-year limitation under §69 can be assessed.',
          fieldPath: 'causeOfActionDate',
          ruleVersion: RULE_VERSION,
        },

  // ── §2(7) consumer eligibility ───────────────────────────────────────────
  (d) =>
    d.purchasedForCommercialPurpose
      ? {
          id: 'consumer.commercial_purpose',
          severity: 'warning',
          message:
            'The goods/services were bought for a commercial purpose. Such a buyer is generally NOT a “consumer” under §2(7) — unless the purchase was exclusively to earn a livelihood by self-employment. Plead the self-employment exception if it applies.',
          fieldPath: 'purchasedForCommercialPurpose',
          ruleVersion: RULE_VERSION,
        }
      : null,

  // ── Grievance + reliefs ──────────────────────────────────────────────────
  (d) =>
    nonEmpty(d.grievance)
      ? null
      : {
          id: 'consumer.grievance_missing',
          severity: 'error',
          message:
            'Describe the defect / deficiency / unfair trade practice and the loss suffered.',
          fieldPath: 'grievance',
          ruleVersion: RULE_VERSION,
        },
  (d) => {
    const reliefs = (d.reliefSought ?? []).filter(nonEmpty);
    return reliefs.length > 0
      ? null
      : {
          id: 'consumer.reliefs_missing',
          severity: 'warning',
          message:
            'Pray for specific reliefs (§39) — refund, replacement, removal of the defect, compensation, or discontinuance of the unfair practice.',
          fieldPath: 'reliefSought',
          ruleVersion: RULE_VERSION,
        };
  },
];

export const consumerComplaintRisks: RisksFunction<
  Partial<ConsumerComplaintData>
> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
