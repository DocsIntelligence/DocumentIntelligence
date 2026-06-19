import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  consumerComplaintFormMetadata,
  consumerComplaintSectionOrder,
} from './form-metadata';
import { consumerComplaintPrompts } from './prompts';
import { consumerComplaintRisks } from './risks';
import {
  ConsumerComplaintDraftSchema,
  type ConsumerComplaintData,
} from './schema';

export const consumerComplaintBundle: DocumentTypeBundle<
  Partial<ConsumerComplaintData>
> = {
  key: 'consumer_complaint',
  schema: ConsumerComplaintDraftSchema,
  formMetadata: consumerComplaintFormMetadata,
  sectionOrder: consumerComplaintSectionOrder,
  risks: consumerComplaintRisks,
  prompts: consumerComplaintPrompts,
  knownTemplates: ['consumer-complaint-standard'],
};

registerDocumentType(consumerComplaintBundle);

export * from './schema';
export {
  consumerComplaintFormMetadata,
  consumerComplaintSectionOrder,
} from './form-metadata';
export { consumerComplaintRisks } from './risks';
export { consumerComplaintPrompts } from './prompts';
