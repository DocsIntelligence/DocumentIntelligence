import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { rtiFormMetadata, rtiSectionOrder } from './form-metadata';
import { rtiPrompts } from './prompts';
import { rtiRisks } from './risks';
import { RtiApplicationDraftSchema, type RtiApplicationData } from './schema';

export const rtiBundle: DocumentTypeBundle<Partial<RtiApplicationData>> = {
  key: 'rti',
  schema: RtiApplicationDraftSchema,
  formMetadata: rtiFormMetadata,
  sectionOrder: rtiSectionOrder,
  risks: rtiRisks,
  prompts: rtiPrompts,
  knownTemplates: ['rti-default-en', 'rti-default-hi'],
};

registerDocumentType(rtiBundle);

export * from './schema';
export { rtiFormMetadata, rtiSectionOrder } from './form-metadata';
export { rtiRisks } from './risks';
export { rtiPrompts } from './prompts';
