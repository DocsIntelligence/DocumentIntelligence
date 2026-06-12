import type { PromptManifest } from '../types';

/**
 * One assist: draft standard invoice terms & conditions. The AI does not touch
 * figures, tax, or party data — only the boilerplate terms text.
 */
export const invoicePrompts: PromptManifest = {
  'invoice.terms': {
    id: 'invoice.terms',
    version: '2026-06-12',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You draft concise invoice terms & conditions (payment due dates, late ' +
      'fees, disputes, ownership-until-paid). 3–6 short bullet-style lines. No ' +
      'figures, no tax advice, no statutory citations. Return only the terms text.',
    user: 'Context:\n{{notes}}\n\nReturn the invoice terms.',
  },
};
