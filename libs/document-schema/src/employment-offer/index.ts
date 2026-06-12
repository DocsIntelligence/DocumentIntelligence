import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  employmentOfferFormMetadata,
  employmentOfferSectionOrder,
} from './form-metadata';
import { employmentOfferPrompts } from './prompts';
import { employmentOfferRisks } from './risks';
import {
  EmploymentOfferDraftSchema,
  type EmploymentOfferData,
} from './schema';

export const employmentOfferBundle: DocumentTypeBundle<
  Partial<EmploymentOfferData>
> = {
  key: 'employment_offer',
  schema: EmploymentOfferDraftSchema,
  formMetadata: employmentOfferFormMetadata,
  sectionOrder: employmentOfferSectionOrder,
  risks: employmentOfferRisks,
  prompts: employmentOfferPrompts,
  knownTemplates: ['offer-standard'],
};

registerDocumentType(employmentOfferBundle);

export * from './schema';
export {
  employmentOfferFormMetadata,
  employmentOfferSectionOrder,
} from './form-metadata';
export { employmentOfferRisks } from './risks';
export { employmentOfferPrompts } from './prompts';
