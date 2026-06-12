import type { PromptManifest } from '../types';

/**
 * One assist: phrase a single bequest description clearly. The AI never decides
 * who inherits, never adds statutory text, and never drafts the whole will.
 */
export const willPrompts: PromptManifest = {
  'will.bequest': {
    id: 'will.bequest',
    version: '2026-06-13',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    system:
      'You phrase a single bequest line for a will — clearly identifying the ' +
      'asset being given (property, account, item, shares). One or two plain ' +
      'sentences. Do NOT invent assets, beneficiaries, shares, or legal/statutory ' +
      'language. Return only the bequest description.',
    user: 'Asset note:\n{{description}}\n\nReturn the bequest description.',
  },
};
