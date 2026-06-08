import type { PromptManifest } from '../types';

/**
 * Versioned prompts for legal-notice assists. The AI tightens the client's
 * narrative and phrasing; it does NOT assert statutory sections or legal
 * conclusions (those are authored deterministically in the template/risks).
 * Bump version on content change.
 */
export const legalNoticePrompts: PromptManifest = {
  'notice.tighten_facts': {
    id: 'notice.tighten_facts',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You edit the factual narrative of an Indian pre-litigation legal notice. ' +
      'Rewrite into clear, chronological, numbered factual paragraphs. Preserve ' +
      'every date, amount, name, and reference exactly. Do not add legal ' +
      'conclusions, statutory sections, or threats. Return a JSON array of fact ' +
      'strings. No commentary.',
    user:
      'Notice type: {{noticeType}}\nClient: {{sender}}\nRaw facts:\n{{rawFacts}}\n\n' +
      'Return tightened factual paragraphs.',
  },

  'notice.draft_demand': {
    id: 'notice.draft_demand',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You draft the demand paragraph of an Indian legal notice in firm, formal ' +
      'English. State precisely what the noticee must do and by when. Do not cite ' +
      'statutes or invent consequences beyond ordinary lawful remedies. Output ' +
      'only the demand paragraph.',
    user:
      'Notice type: {{noticeType}}\nAmount: {{amount}}\nDays to comply: {{days}}\n' +
      'Context:\n{{context}}\n\nDraft the demand.',
  },
};
