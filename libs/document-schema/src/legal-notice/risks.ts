import type { RisksFunction, Warning } from '../types';
import type { LegalNoticeData } from './schema';

/**
 * Deterministic risk rules for legal notices (NOT LLM outputs). Statutory
 * references author-verified.
 *
 * Anchors: NI Act 1881 §138 (proviso (b): demand within 30 days of the
 * dishonour intimation; proviso (c): drawer gets 15 days from receipt to pay),
 * §142 (complaint within 1 month of cause of action).
 */

type Rule = (data: Partial<LegalNoticeData>) => Warning | null;

const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

const rules: Rule[] = [
  // Parties present.
  (data) => {
    if (!nonEmpty(data.sender?.name)) {
      return {
        id: 'notice.sender_missing',
        severity: 'error',
        message: 'The sender (client) name is required.',
        fieldPath: 'sender.name',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
  (data) => {
    if (!nonEmpty(data.recipient?.name)) {
      return {
        id: 'notice.recipient_missing',
        severity: 'error',
        message: 'The recipient (noticee) name is required.',
        fieldPath: 'recipient.name',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
  (data) => {
    if (!nonEmpty(data.recipient?.address)) {
      return {
        id: 'notice.recipient_address_missing',
        severity: 'warning',
        message:
          'A serviceable address for the noticee is essential — service of the notice is what makes it legally effective.',
        fieldPath: 'recipient.address',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // At least one fact.
  (data) => {
    const facts = (data.content?.facts ?? []).filter(nonEmpty);
    if (facts.length === 0) {
      return {
        id: 'notice.facts_empty',
        severity: 'warning',
        message:
          'State the facts giving rise to the notice (numbered paragraphs).',
        fieldPath: 'content.facts',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // ─── Cheque-bounce specific ────────────────────────────────────────────
  (data) => {
    if (data.noticeType !== 'cheque_bounce') return null;
    if (!data.cheque || !nonEmpty(data.cheque.number) || !data.cheque.amount) {
      return {
        id: 'notice.cheque_details_missing',
        severity: 'error',
        message:
          'For a cheque-bounce notice, the cheque number and amount are mandatory (NI Act §138).',
        fieldPath: 'cheque.number',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // §138 proviso (c): the drawer must be given 15 days to pay.
  (data) => {
    if (data.noticeType !== 'cheque_bounce') return null;
    const days = data.content?.complianceDays;
    if (days != null && days < 15) {
      return {
        id: 'notice.cheque_15_day_demand',
        severity: 'error',
        message:
          'A cheque-bounce notice must give the drawer at least 15 days from receipt to pay (proviso (c) to NI Act §138). Set days to comply to 15 or more.',
        fieldPath: 'content.complianceDays',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // §138 proviso (b): demand must be made within 30 days of the dishonour memo.
  (data) => {
    if (data.noticeType !== 'cheque_bounce') return null;
    const dishonour = data.cheque?.dishonourDate;
    const notice = data.noticeDate;
    if (!dishonour || !notice) return null;
    const days = Math.round(
      (new Date(notice).getTime() - new Date(dishonour).getTime()) / 86_400_000,
    );
    if (days > 30) {
      return {
        id: 'notice.cheque_30_day_window',
        severity: 'error',
        message:
          'The demand notice must be issued within 30 days of receiving the cheque-return memo (proviso (b) to NI Act §138). This notice appears to be beyond 30 days from the dishonour date.',
        fieldPath: 'noticeDate',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },

  // Demand clarity.
  (data) => {
    if (!nonEmpty(data.content?.demandText) && !data.content?.demandAmount) {
      return {
        id: 'notice.demand_missing',
        severity: 'warning',
        message:
          'State a clear demand — what the noticee must do (and any amount) and by when.',
        fieldPath: 'content.demandText',
        ruleVersion: '2026-01-01',
      };
    }
    return null;
  },
];

export const legalNoticeRisks: RisksFunction<Partial<LegalNoticeData>> = (
  data,
) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
