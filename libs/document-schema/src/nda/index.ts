import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { ndaFormMetadata, ndaSectionOrder } from './form-metadata';
import { ndaPrompts } from './prompts';
import { ndaRisks } from './risks';
import { NdaDraftSchema, type NdaData } from './schema';

export const ndaBundle: DocumentTypeBundle<Partial<NdaData>> = {
  key: 'nda',
  schema: NdaDraftSchema,
  formMetadata: ndaFormMetadata,
  sectionOrder: ndaSectionOrder,
  risks: ndaRisks,
  prompts: ndaPrompts,
  knownTemplates: ['nda-standard'],
};

registerDocumentType(ndaBundle);

export * from './schema';
export { ndaFormMetadata, ndaSectionOrder } from './form-metadata';
export { ndaRisks } from './risks';
export { ndaPrompts } from './prompts';
