import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { receiptFormMetadata, receiptSectionOrder } from './form-metadata';
import { receiptPrompts } from './prompts';
import { receiptRisks } from './risks';
import { ReceiptDraftSchema, type ReceiptData } from './schema';

export const receiptBundle: DocumentTypeBundle<Partial<ReceiptData>> = {
  key: 'receipt',
  schema: ReceiptDraftSchema,
  formMetadata: receiptFormMetadata,
  sectionOrder: receiptSectionOrder,
  risks: receiptRisks,
  prompts: receiptPrompts,
  knownTemplates: ['receipt-standard'],
};

registerDocumentType(receiptBundle);

export * from './schema';
export { receiptFormMetadata, receiptSectionOrder } from './form-metadata';
export { receiptRisks } from './risks';
export { receiptPrompts } from './prompts';
