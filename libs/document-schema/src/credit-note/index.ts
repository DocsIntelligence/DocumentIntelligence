import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import {
  creditNoteFormMetadata,
  creditNoteSectionOrder,
} from './form-metadata';
import { creditNotePrompts } from './prompts';
import { creditNoteRisks } from './risks';
import { CreditNoteDraftSchema, type CreditNoteData } from './schema';

export const creditNoteBundle: DocumentTypeBundle<Partial<CreditNoteData>> = {
  key: 'credit_note',
  schema: CreditNoteDraftSchema,
  formMetadata: creditNoteFormMetadata,
  sectionOrder: creditNoteSectionOrder,
  risks: creditNoteRisks,
  prompts: creditNotePrompts,
  knownTemplates: ['credit-note-standard'],
};

registerDocumentType(creditNoteBundle);

export * from './schema';
export {
  creditNoteFormMetadata,
  creditNoteSectionOrder,
} from './form-metadata';
export { creditNoteRisks } from './risks';
export { creditNotePrompts } from './prompts';
