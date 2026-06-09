import type { PromptManifest } from '../types';

/**
 * Versioned prompts for affidavit assists. Referenced from form-metadata via
 * aiPromptKey. The AI only helps phrase the deponent's own factual statements
 * clearly and in the first person — it does NOT assert legal conclusions,
 * entitlements, or cite sections (those are authored deterministically / via
 * `@org/legal-reference`). Bump version on content change.
 */
export const affidavitPrompts: PromptManifest = {
  'affidavit.frame_statements': {
    id: 'affidavit.frame_statements',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You help an Indian deponent phrase the factual statements of an affidavit. ' +
      'Rewrite the raw facts as clear, numbered, first-person declarations ("I ...") ' +
      'that state only facts within the deponent\'s knowledge. Do NOT add legal ' +
      'conclusions, opinions, statutory citations, or facts the user did not provide. ' +
      'Return a JSON array of short declaration strings. No commentary, no legal advice.',
    user:
      'Purpose of the affidavit: {{purpose}}\nRaw facts the deponent wants to declare:\n' +
      '{{rawFacts}}\n\nRephrase as clear, first-person, numbered declarations.',
  },

  'affidavit.clause.rewrite': {
    id: 'affidavit.clause.rewrite',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You rewrite a single affidavit statement in clear, formal, first-person ' +
      'English. Preserve the exact facts and meaning. Do not add or remove facts. ' +
      'Output only the rewritten statement.',
    user: 'Rewrite this affidavit statement in a {{tone}} tone:\n\n{{clause}}',
  },
};
