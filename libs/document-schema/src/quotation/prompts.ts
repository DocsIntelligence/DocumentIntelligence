import type { PromptManifest } from '../types';

/**
 * One assist: draft standard quotation terms (validity, taxes extra, delivery
 * lead-time, payment on confirmation). No figures, no statutory citations.
 */
export const quotationPrompts: PromptManifest = {
  'quotation.terms': {
    id: 'quotation.terms',
    version: '2026-06-13',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You draft concise quotation terms & conditions (validity period, taxes ' +
      'extra unless stated, delivery lead-time, payment on confirmation/advance, ' +
      'prices subject to change after validity). 3–6 short bullet-style lines. ' +
      'No figures, no tax advice, no statutory citations. Return only the terms text.',
    user: 'Context:\n{{notes}}\n\nReturn the quotation terms.',
  },
};
