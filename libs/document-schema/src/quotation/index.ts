import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { quotationFormMetadata, quotationSectionOrder } from './form-metadata';
import { quotationPrompts } from './prompts';
import { quotationRisks } from './risks';
import { QuotationDraftSchema, type QuotationData } from './schema';

export const quotationBundle: DocumentTypeBundle<Partial<QuotationData>> = {
  key: 'quotation',
  schema: QuotationDraftSchema,
  formMetadata: quotationFormMetadata,
  sectionOrder: quotationSectionOrder,
  risks: quotationRisks,
  prompts: quotationPrompts,
  knownTemplates: ['quotation-standard'],
};

registerDocumentType(quotationBundle);

export * from './schema';
export { quotationFormMetadata, quotationSectionOrder } from './form-metadata';
export { quotationRisks } from './risks';
export { quotationPrompts } from './prompts';
