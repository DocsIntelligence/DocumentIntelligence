import type { PromptManifest } from '../types';

/**
 * Versioned prompts for the §138 cheque-bounce notice. The AI only tightens the
 * client's narrative/phrasing — it does NOT assert statutory sections, deadlines,
 * or legal conclusions (those are authored deterministically in the template +
 * risks + `@org/legal-reference`). Bump version on content change.
 */
export const chequeBounceNoticePrompts: PromptManifest = {
  'cheque.describe_liability': {
    id: 'cheque.describe_liability',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You refine one paragraph describing the legally enforceable debt or ' +
      'liability that a dishonoured cheque was issued to discharge, for an Indian ' +
      'cheque-bounce demand notice. Keep every date, amount, invoice/loan ' +
      'reference, and name exactly. Do not add statutory sections, deadlines, or ' +
      'legal conclusions. Output only the paragraph.',
    user:
      'Cheque amount: {{amount}}\nDrawer: {{drawer}}\nRaw description:\n{{context}}\n\n' +
      'Return the refined liability paragraph.',
  },

  'cheque.tighten_facts': {
    id: 'cheque.tighten_facts',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You edit the factual narrative of an Indian §138 cheque-bounce notice. ' +
      'Rewrite into clear, chronological, numbered factual paragraphs. Preserve ' +
      'every date, amount, name, and cheque/bank reference exactly. Do not add ' +
      'statutory sections, deadlines, or threats. Return a JSON array of fact ' +
      'strings. No commentary.',
    user:
      'Payee: {{payee}}\nDrawer: {{drawer}}\nRaw facts:\n{{rawFacts}}\n\n' +
      'Return tightened factual paragraphs.',
  },
};
