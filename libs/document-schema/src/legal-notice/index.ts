import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  legalNoticeFormMetadata,
  legalNoticeSectionOrder,
} from './form-metadata';
import { legalNoticePrompts } from './prompts';
import { legalNoticeRisks } from './risks';
import { LegalNoticeDraftSchema, type LegalNoticeData } from './schema';

export const legalNoticeBundle: DocumentTypeBundle<Partial<LegalNoticeData>> = {
  key: 'legal_notice',
  schema: LegalNoticeDraftSchema,
  formMetadata: legalNoticeFormMetadata,
  sectionOrder: legalNoticeSectionOrder,
  risks: legalNoticeRisks,
  prompts: legalNoticePrompts,
  knownTemplates: ['notice-formal'],
};

registerDocumentType(legalNoticeBundle);

export * from './schema';
export {
  legalNoticeFormMetadata,
  legalNoticeSectionOrder,
} from './form-metadata';
export { legalNoticeRisks } from './risks';
export { legalNoticePrompts } from './prompts';
