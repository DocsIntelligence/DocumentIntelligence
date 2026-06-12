import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  purchaseOrderFormMetadata,
  purchaseOrderSectionOrder,
} from './form-metadata';
import { purchaseOrderPrompts } from './prompts';
import { purchaseOrderRisks } from './risks';
import { PurchaseOrderDraftSchema, type PurchaseOrderData } from './schema';

export const purchaseOrderBundle: DocumentTypeBundle<
  Partial<PurchaseOrderData>
> = {
  key: 'purchase_order',
  schema: PurchaseOrderDraftSchema,
  formMetadata: purchaseOrderFormMetadata,
  sectionOrder: purchaseOrderSectionOrder,
  risks: purchaseOrderRisks,
  prompts: purchaseOrderPrompts,
  knownTemplates: ['purchase-order-standard'],
};

registerDocumentType(purchaseOrderBundle);

export * from './schema';
export {
  purchaseOrderFormMetadata,
  purchaseOrderSectionOrder,
} from './form-metadata';
export { purchaseOrderRisks } from './risks';
export { purchaseOrderPrompts } from './prompts';
