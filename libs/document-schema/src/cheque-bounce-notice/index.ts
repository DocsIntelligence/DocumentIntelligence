import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  chequeBounceNoticeFormMetadata,
  chequeBounceNoticeSectionOrder,
} from './form-metadata';
import { chequeBounceNoticePrompts } from './prompts';
import { chequeBounceNoticeRisks } from './risks';
import {
  ChequeBounceNoticeDraftSchema,
  type ChequeBounceNoticeData,
} from './schema';

export const chequeBounceNoticeBundle: DocumentTypeBundle<
  Partial<ChequeBounceNoticeData>
> = {
  key: 'cheque_bounce_notice',
  schema: ChequeBounceNoticeDraftSchema,
  formMetadata: chequeBounceNoticeFormMetadata,
  sectionOrder: chequeBounceNoticeSectionOrder,
  risks: chequeBounceNoticeRisks,
  prompts: chequeBounceNoticePrompts,
  knownTemplates: ['cheque-bounce-formal'],
};

registerDocumentType(chequeBounceNoticeBundle);

export * from './schema';
export {
  chequeBounceNoticeFormMetadata,
  chequeBounceNoticeSectionOrder,
} from './form-metadata';
export { chequeBounceNoticeRisks } from './risks';
export { chequeBounceNoticePrompts } from './prompts';
