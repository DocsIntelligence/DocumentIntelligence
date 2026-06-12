import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { willFormMetadata, willSectionOrder } from './form-metadata';
import { willPrompts } from './prompts';
import { willRisks } from './risks';
import { WillDraftSchema, type WillData } from './schema';

export const willBundle: DocumentTypeBundle<Partial<WillData>> = {
  key: 'will',
  schema: WillDraftSchema,
  formMetadata: willFormMetadata,
  sectionOrder: willSectionOrder,
  risks: willRisks,
  prompts: willPrompts,
  knownTemplates: ['will-standard'],
};

registerDocumentType(willBundle);

export * from './schema';
export { willFormMetadata, willSectionOrder } from './form-metadata';
export { willRisks } from './risks';
export { willPrompts } from './prompts';
