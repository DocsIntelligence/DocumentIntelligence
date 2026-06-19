import type { PromptManifest } from '../types';

/**
 * Versioned prompts for the CPA 2019 consumer complaint. The AI only tightens
 * the complainant's narrative/phrasing — it does NOT assert statutory sections,
 * jurisdiction, limitation, or legal conclusions (those are authored
 * deterministically in the template + risks + `@org/legal-reference`). Bump
 * version on content change.
 */
export const consumerComplaintPrompts: PromptManifest = {
  'consumer.describe_transaction': {
    id: 'consumer.describe_transaction',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You refine one paragraph describing a consumer transaction (goods bought ' +
      'or service availed) for an Indian consumer complaint. Keep every date, ' +
      'amount, invoice/order/policy reference, and name exactly. Do not add ' +
      'statutory sections, jurisdiction, or legal conclusions. Output only the paragraph.',
    user:
      'Consideration paid: {{amount}}\nOpposite party: {{oppositeParty}}\nRaw description:\n{{context}}\n\n' +
      'Return the refined transaction paragraph.',
  },

  'consumer.describe_grievance': {
    id: 'consumer.describe_grievance',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You refine the grievance narrative of an Indian consumer complaint — the ' +
      'defect, deficiency, or unfair trade practice and the loss/injury suffered. ' +
      'Keep every fact, date, and amount exactly. Do not add statutory sections, ' +
      'jurisdiction, limitation, threats, or legal conclusions. Output only the paragraph.',
    user:
      'Nature: {{grievanceType}}\nTransaction: {{transaction}}\nRaw grievance:\n{{context}}\n\n' +
      'Return the refined grievance paragraph.',
  },

  'consumer.tighten_facts': {
    id: 'consumer.tighten_facts',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You edit the factual narrative of an Indian consumer complaint. Rewrite ' +
      'into clear, chronological, numbered factual paragraphs. Preserve every ' +
      'date, amount, name, and reference exactly. Do not add statutory sections, ' +
      'jurisdiction, or legal conclusions. Return a JSON array of fact strings. No commentary.',
    user:
      'Complainant: {{complainant}}\nOpposite party: {{oppositeParty}}\nRaw facts:\n{{rawFacts}}\n\n' +
      'Return tightened factual paragraphs.',
  },

  'consumer.suggest_reliefs': {
    id: 'consumer.suggest_reliefs',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    system:
      'You draft a concise list of reliefs for an Indian consumer complaint, ' +
      'grounded ONLY in the facts provided and the kinds of relief a Consumer ' +
      'Commission may grant (refund, replacement, removal of defect/deficiency, ' +
      'compensation, discontinuance of an unfair trade practice, litigation costs). ' +
      'Do not invent amounts not supported by the facts. Return a JSON array of ' +
      'short relief strings. No commentary, no statutory section numbers.',
    user:
      'Consideration paid: {{amount}}\nGrievance:\n{{grievance}}\n\n' +
      'Return the list of reliefs to pray for.',
  },
};
