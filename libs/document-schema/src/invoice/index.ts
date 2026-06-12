import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { invoiceFormMetadata, invoiceSectionOrder } from './form-metadata';
import { invoicePrompts } from './prompts';
import { invoiceRisks } from './risks';
import { InvoiceDraftSchema, type InvoiceData } from './schema';

export const invoiceBundle: DocumentTypeBundle<Partial<InvoiceData>> = {
  key: 'invoice',
  schema: InvoiceDraftSchema,
  formMetadata: invoiceFormMetadata,
  sectionOrder: invoiceSectionOrder,
  risks: invoiceRisks,
  prompts: invoicePrompts,
  knownTemplates: ['invoice-standard'],
};

registerDocumentType(invoiceBundle);

export * from './schema';
export { invoiceFormMetadata, invoiceSectionOrder } from './form-metadata';
export { invoiceRisks } from './risks';
export { invoicePrompts } from './prompts';
