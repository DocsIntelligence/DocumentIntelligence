import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  promissoryNoteFormMetadata,
  promissoryNoteSectionOrder,
} from './form-metadata';
import { promissoryNotePrompts } from './prompts';
import { promissoryNoteRisks } from './risks';
import {
  PromissoryNoteDraftSchema,
  type PromissoryNoteData,
} from './schema';

export const promissoryNoteBundle: DocumentTypeBundle<
  Partial<PromissoryNoteData>
> = {
  key: 'promissory_note',
  schema: PromissoryNoteDraftSchema,
  formMetadata: promissoryNoteFormMetadata,
  sectionOrder: promissoryNoteSectionOrder,
  risks: promissoryNoteRisks,
  prompts: promissoryNotePrompts,
  knownTemplates: ['pronote-standard'],
};

registerDocumentType(promissoryNoteBundle);

export * from './schema';
export {
  promissoryNoteFormMetadata,
  promissoryNoteSectionOrder,
} from './form-metadata';
export { promissoryNoteRisks } from './risks';
export { promissoryNotePrompts } from './prompts';
