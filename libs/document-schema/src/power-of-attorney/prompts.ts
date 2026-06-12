import type { PromptManifest } from '../types';

/**
 * One assist: tighten the list of powers into clear, specific authorisations.
 * The AI does not decide scope or add statutory references — it only rephrases
 * the user's intended powers.
 */
export const powerOfAttorneyPrompts: PromptManifest = {
  'poa.tighten_powers': {
    id: 'poa.tighten_powers',
    version: '2026-06-12',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You rewrite the powers granted in an Indian Power of Attorney into a ' +
      'clear, numbered list of specific authorisations. Keep each power precise ' +
      'and self-contained. Do not broaden the scope, add statutory sections, or ' +
      'add powers the user did not mention. Return a JSON array of strings.',
    user: 'Type: {{type}}\nUser note:\n{{powers}}\n\nReturn the powers list.',
  },
};
