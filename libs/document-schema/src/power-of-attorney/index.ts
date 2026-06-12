import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  powerOfAttorneyFormMetadata,
  powerOfAttorneySectionOrder,
} from './form-metadata';
import { powerOfAttorneyPrompts } from './prompts';
import { powerOfAttorneyRisks } from './risks';
import {
  PowerOfAttorneyDraftSchema,
  type PowerOfAttorneyData,
} from './schema';

export const powerOfAttorneyBundle: DocumentTypeBundle<
  Partial<PowerOfAttorneyData>
> = {
  key: 'power_of_attorney',
  schema: PowerOfAttorneyDraftSchema,
  formMetadata: powerOfAttorneyFormMetadata,
  sectionOrder: powerOfAttorneySectionOrder,
  risks: powerOfAttorneyRisks,
  prompts: powerOfAttorneyPrompts,
  knownTemplates: ['poa-standard'],
};

registerDocumentType(powerOfAttorneyBundle);

export * from './schema';
export {
  powerOfAttorneyFormMetadata,
  powerOfAttorneySectionOrder,
} from './form-metadata';
export { powerOfAttorneyRisks } from './risks';
export { powerOfAttorneyPrompts } from './prompts';
