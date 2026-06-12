import { registerDocumentType } from '../_registry';
import type { DocumentTypeBundle } from '../types';
import { payslipFormMetadata, payslipSectionOrder } from './form-metadata';
import { payslipPrompts } from './prompts';
import { payslipRisks } from './risks';
import { PayslipDraftSchema, type PayslipData } from './schema';

export const payslipBundle: DocumentTypeBundle<Partial<PayslipData>> = {
  key: 'payslip',
  schema: PayslipDraftSchema,
  formMetadata: payslipFormMetadata,
  sectionOrder: payslipSectionOrder,
  risks: payslipRisks,
  prompts: payslipPrompts,
  knownTemplates: ['payslip-standard'],
};

registerDocumentType(payslipBundle);

export * from './schema';
export { payslipFormMetadata, payslipSectionOrder } from './form-metadata';
export { payslipRisks } from './risks';
export { payslipPrompts } from './prompts';
