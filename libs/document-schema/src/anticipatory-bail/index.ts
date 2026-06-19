import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  anticipatoryBailFormMetadata,
  anticipatoryBailSectionOrder,
} from './form-metadata';
import { anticipatoryBailPrompts } from './prompts';
import { anticipatoryBailRisks } from './risks';
import {
  AnticipatoryBailDraftSchema,
  type AnticipatoryBailData,
} from './schema';

export const anticipatoryBailBundle: DocumentTypeBundle<
  Partial<AnticipatoryBailData>
> = {
  key: 'anticipatory_bail',
  schema: AnticipatoryBailDraftSchema,
  formMetadata: anticipatoryBailFormMetadata,
  sectionOrder: anticipatoryBailSectionOrder,
  risks: anticipatoryBailRisks,
  prompts: anticipatoryBailPrompts,
  knownTemplates: ['anticipatory-bail-standard'],
};

registerDocumentType(anticipatoryBailBundle);

export * from './schema';
export {
  anticipatoryBailFormMetadata,
  anticipatoryBailSectionOrder,
} from './form-metadata';
export { anticipatoryBailRisks } from './risks';
export { anticipatoryBailPrompts } from './prompts';
