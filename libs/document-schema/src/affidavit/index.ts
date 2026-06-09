import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { affidavitFormMetadata, affidavitSectionOrder } from './form-metadata';
import { affidavitPrompts } from './prompts';
import { affidavitRisks } from './risks';
import { AffidavitDraftSchema, type AffidavitData } from './schema';

export const affidavitBundle: DocumentTypeBundle<Partial<AffidavitData>> = {
  key: 'affidavit',
  schema: AffidavitDraftSchema,
  formMetadata: affidavitFormMetadata,
  sectionOrder: affidavitSectionOrder,
  risks: affidavitRisks,
  prompts: affidavitPrompts,
  knownTemplates: ['affidavit-default-en'],
};

registerDocumentType(affidavitBundle);

export * from './schema';
export { affidavitFormMetadata, affidavitSectionOrder } from './form-metadata';
export { affidavitRisks } from './risks';
export { affidavitPrompts } from './prompts';
