import type { PromptManifest } from '../types';

/** One small assist: tidy the "received towards" description. No figures/legal. */
export const receiptPrompts: PromptManifest = {
  'receipt.towards': {
    id: 'receipt.towards',
    version: '2026-06-13',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    system:
      'You phrase the "received towards" line of a payment receipt — a short ' +
      'noun phrase describing what the payment is for (e.g. "rent for June ' +
      '2026", "advance against purchase order #123"). No amounts, no legal ' +
      'language. Return only the phrase.',
    user: 'Note:\n{{towards}}\n\nReturn the description.',
  },
};
