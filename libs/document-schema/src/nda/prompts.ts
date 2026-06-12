import type { PromptManifest } from '../types';

/**
 * Versioned prompts for NDA assists. The AI tightens the user's plain-English
 * inputs (the purpose statement, the list of what counts as confidential); it
 * does NOT assert statutory sections or invent obligations — the operative
 * clauses are authored deterministically in the template. Bump version on
 * content change.
 */
export const ndaPrompts: PromptManifest = {
  'nda.tighten_purpose': {
    id: 'nda.tighten_purpose',
    version: '2026-06-12',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You refine the "purpose" recital of an Indian non-disclosure agreement. ' +
      'Rewrite the user\'s note into a single, precise sentence describing the ' +
      'permitted purpose for which confidential information is shared. Keep it ' +
      'neutral and specific; do not add obligations, statutory references, or ' +
      'defined terms. Return only the sentence.',
    user: 'Mutual: {{mutual}}\nUser note:\n{{purpose}}\n\nReturn the refined purpose.',
  },

  'nda.suggest_scope': {
    id: 'nda.suggest_scope',
    version: '2026-06-12',
    model: 'gpt-4o-mini',
    temperature: 0.4,
    system:
      'You list the categories of information that should be treated as ' +
      'Confidential Information in an Indian NDA, based on the stated purpose. ' +
      'Return a JSON array of short noun phrases (e.g. "business plans", ' +
      '"source code", "customer lists"). No commentary, no legal conclusions.',
    user: 'Purpose:\n{{purpose}}\n\nReturn the confidential-information categories.',
  },
};
