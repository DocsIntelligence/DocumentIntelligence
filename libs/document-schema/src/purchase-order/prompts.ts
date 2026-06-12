import type { PromptManifest } from '../types';

/**
 * One assist: draft standard purchase-order terms (delivery, inspection,
 * invoicing reference, cancellation). No figures, no statutory citations.
 */
export const purchaseOrderPrompts: PromptManifest = {
  'purchaseOrder.terms': {
    id: 'purchaseOrder.terms',
    version: '2026-06-13',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You draft concise purchase-order terms & conditions (delivery on/before ' +
      'the required-by date, inspection/acceptance, invoice must quote this PO ' +
      'number, partial deliveries, cancellation for delay). 3–6 short bullet-' +
      'style lines. No figures, no statutory citations. Return only the terms text.',
    user: 'Context:\n{{notes}}\n\nReturn the purchase-order terms.',
  },
};
