import type { PromptManifest } from '../types';

/**
 * Versioned prompts for the BNSS §482 anticipatory-bail application. The AI only
 * tightens the applicant's narrative/grounds — it does NOT assert statutory
 * sections, the forum, or legal conclusions (those are authored deterministically
 * in the template + risks + `@org/legal-reference`). Bump version on content change.
 */
export const anticipatoryBailPrompts: PromptManifest = {
  'bail.describe_apprehension': {
    id: 'bail.describe_apprehension',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You refine the paragraph stating why an applicant reasonably apprehends ' +
      'arrest, for an Indian anticipatory-bail application. Keep every date, name, ' +
      'FIR reference, and fact exactly. Do not add statutory sections, the forum, ' +
      'or legal conclusions. Output only the paragraph.',
    user:
      'FIR: {{fir}}\nOffences alleged: {{offences}}\nRaw apprehension:\n{{context}}\n\n' +
      'Return the refined apprehension paragraph.',
  },

  'bail.suggest_grounds': {
    id: 'bail.suggest_grounds',
    version: '2026-06-19',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    system:
      'You draft a concise list of grounds for an Indian anticipatory-bail ' +
      'application, grounded ONLY in the facts provided (e.g. false implication, ' +
      'no criminal antecedents, deep roots in society, willingness to cooperate, ' +
      'no need for custodial interrogation). Do not invent facts. Do not cite ' +
      'statutory sections or case law. Return a JSON array of short ground strings. No commentary.',
    user:
      'Applicant: {{applicant}}\nOffences alleged: {{offences}}\nApprehension:\n{{apprehension}}\n\n' +
      'Return the grounds for anticipatory bail.',
  },
};
