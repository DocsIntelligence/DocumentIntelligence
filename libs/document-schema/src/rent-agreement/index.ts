import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  rentAgreementFormMetadata,
  rentAgreementSectionOrder,
} from './form-metadata';
import { rentAgreementPrompts } from './prompts';
import { rentAgreementRisks } from './risks';
import { RentAgreementDraftSchema, type RentAgreementData } from './schema';

export const rentAgreementBundle: DocumentTypeBundle<
  Partial<RentAgreementData>
> = {
  key: 'rent_agreement',
  schema: RentAgreementDraftSchema,
  formMetadata: rentAgreementFormMetadata,
  sectionOrder: rentAgreementSectionOrder,
  risks: rentAgreementRisks,
  prompts: rentAgreementPrompts,
  knownTemplates: ['rent-classic', 'rent-bilingual'],
};

registerDocumentType(rentAgreementBundle);

export * from './schema';
export { rentAgreementFormMetadata, rentAgreementSectionOrder } from './form-metadata';
export { rentAgreementRisks } from './risks';
export { rentAgreementPrompts } from './prompts';
