import type { RisksFunction, Warning } from '../types';
import type { AnticipatoryBailData } from './schema';

/**
 * Deterministic BNSS §482 anticipatory-bail risk rules (NOT LLM outputs).
 *
 *   §482 — lies only before the Court of Session / High Court; presupposes a
 *     reasonable apprehension of arrest for a NON-bailable offence;
 *   an FIR need not exist, but if there is neither an FIR nor stated grounds of
 *     apprehension there is nothing to anchor the plea;
 *   ⚠️ cite BNSS §482, NOT the repealed CrPC §438 — and beware the renumbering
 *     trap (old CrPC §482 = inherent powers, now BNSS §528).
 */

const RULE_VERSION = '2026-06-19';
const nonEmpty = (s?: string) => !!s && s.trim().length > 0;

type Rule = (data: Partial<AnticipatoryBailData>) => Warning | null;

const rules: Rule[] = [
  // ── Applicant ───────────────────────────────────────────────────────────
  (d) =>
    nonEmpty(d.applicant?.name)
      ? null
      : {
          id: 'bail.applicant_missing',
          severity: 'error',
          message: 'The applicant (proposed accused) name is required.',
          fieldPath: 'applicant.name',
          ruleVersion: RULE_VERSION,
        },
  (d) =>
    nonEmpty(d.applicant?.address)
      ? null
      : {
          id: 'bail.applicant_address_missing',
          severity: 'warning',
          message:
            'State the applicant’s address — settled residence (“roots in society”) is a standard ground for anticipatory bail.',
          fieldPath: 'applicant.address',
          ruleVersion: RULE_VERSION,
        },

  // ── Apprehension (the foundation of §482) ────────────────────────────────
  (d) =>
    nonEmpty(d.apprehensionGrounds)
      ? null
      : {
          id: 'bail.apprehension_missing',
          severity: 'error',
          message:
            'State why the applicant reasonably apprehends arrest — a §482 application stands or falls on the apprehension of arrest.',
          fieldPath: 'apprehensionGrounds',
          ruleVersion: RULE_VERSION,
        },

  // No FIR AND no apprehension narrative → nothing anchors the plea.
  (d) => {
    const hasFir = nonEmpty(d.fir?.number);
    const hasApprehension = nonEmpty(d.apprehensionGrounds);
    if (!hasFir && !hasApprehension) {
      return {
        id: 'bail.no_fir_no_apprehension',
        severity: 'warning',
        message:
          'There is neither an FIR number nor a stated apprehension. An FIR is not mandatory for anticipatory bail, but a concrete, reasonable apprehension of arrest must be pleaded.',
        fieldPath: 'fir.number',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },

  // ── Non-bailable premise ─────────────────────────────────────────────────
  (d) =>
    d.offenceIsNonBailable === false
      ? {
          id: 'bail.offence_bailable',
          severity: 'info',
          message:
            'The alleged offence is marked bailable. Anticipatory bail under §482 is meant for the apprehension of arrest in NON-bailable offences — in a bailable offence bail is available as of right on arrest.',
          fieldPath: 'offenceIsNonBailable',
          ruleVersion: RULE_VERSION,
        }
      : null,

  // ── Offences alleged ─────────────────────────────────────────────────────
  (d) => {
    const offences = (d.offences ?? []).filter(nonEmpty);
    return offences.length > 0
      ? null
      : {
          id: 'bail.offences_missing',
          severity: 'warning',
          message:
            'List the offences alleged (copied from the FIR). The court must know the sections invoked to assess the gravity of the accusation.',
          fieldPath: 'offences',
          ruleVersion: RULE_VERSION,
        };
  },

  // ── Grounds for bail ─────────────────────────────────────────────────────
  (d) => {
    const grounds = (d.groundsForBail ?? []).filter(nonEmpty);
    return grounds.length > 0
      ? null
      : {
          id: 'bail.grounds_missing',
          severity: 'warning',
          message:
            'Urge specific grounds for bail (false implication, no antecedents, cooperation, no need for custodial interrogation, roots in society).',
          fieldPath: 'groundsForBail',
          ruleVersion: RULE_VERSION,
        };
  },

  // ── Currency note: cite BNSS §482, not CrPC §438 ─────────────────────────
  (d) => {
    const offenceText = (d.offences ?? []).join(' ').toLowerCase();
    if (/\b438\b|crpc|cr\.p\.c|code of criminal procedure/.test(offenceText)) {
      return {
        id: 'bail.crpc_reference',
        severity: 'warning',
        message:
          'A reference to CrPC / §438 was detected. Anticipatory bail is now governed by Section 482 of the BNSS, 2023 (in force 1 Jul 2024) — do not file under the repealed CrPC §438.',
        fieldPath: 'offences',
        ruleVersion: RULE_VERSION,
      };
    }
    return null;
  },
];

export const anticipatoryBailRisks: RisksFunction<
  Partial<AnticipatoryBailData>
> = (data) => {
  const warnings: Warning[] = [];
  for (const rule of rules) {
    const w = rule(data);
    if (w) warnings.push(w);
  }
  return warnings;
};
