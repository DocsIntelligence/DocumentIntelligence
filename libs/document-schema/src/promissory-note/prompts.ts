import type { PromptManifest } from '../types';

/**
 * A promissory note is a short, formulaic instrument — there is little for AI
 * to draft. The single assist tidies the "consideration" phrase. The AI never
 * authors statutory references or alters the operative promise (authored
 * deterministically in the template).
 */
export const promissoryNotePrompts: PromptManifest = {
  'pronote.consideration': {
    id: 'pronote.consideration',
    version: '2026-06-12',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    system:
      'You phrase the "for value received" recital of an Indian promissory ' +
      'note. Turn the user note into a short clause describing the ' +
      'consideration (e.g. "for value received by way of a hand loan"). Keep ' +
      'it under 20 words; no statutory references, no interest or repayment ' +
      'terms. Return only the clause.',
    user: 'User note:\n{{consideration}}\n\nReturn the consideration clause.',
  },
};
