/**
 * RTI Application ExtractionSchema (docs/05 §5.5, §11.4) — co-designed with
 * `@org/document-schema`'s `rtiBundle`. The FieldMap routes flat extraction
 * keys onto the bundle's nested Zod paths for structured convert (Phase 3).
 */

import type { FieldMap } from '../field-map';
import type { ExtractionSchema } from '../types';
import { registerExtractionSchema } from './_registry';

export const rtiExtractionSchema: ExtractionSchema = {
  key: 'rti',
  name: 'RTI Application',
  version: '2026-06-09',
  documentTypeKey: 'rti',
  description: 'An application under the Right to Information Act, 2005.',
  fields: [
    { key: 'place', label: 'Place', type: 'string' },
    { key: 'application_date', label: 'Application date', type: 'date', format: 'DD/MM/YYYY' },
    { key: 'applicant_name', label: 'Applicant — full name', type: 'string', required: true },
    { key: 'applicant_address', label: 'Applicant — address', type: 'string', required: true },
    { key: 'applicant_is_bpl', label: 'Applicant is BPL (fee-exempt)?', type: 'boolean' },
    { key: 'public_authority', label: 'Public authority', type: 'string', required: true },
    { key: 'department', label: 'Department', type: 'string' },
    { key: 'office_address', label: 'Office address', type: 'string' },
    { key: 'subject', label: 'Subject of the request', type: 'string', required: true },
    {
      key: 'questions',
      label: 'Information sought (questions)',
      type: 'table',
      description: 'Each numbered question/point of information requested.',
      columns: [{ key: 'text', label: 'Question', type: 'string' }],
    },
    { key: 'fee_amount', label: 'Fee paid (₹)', type: 'currency', format: 'INR' },
  ],
};

export const rtiFieldMap: FieldMap = {
  schemaKey: 'rti',
  documentTypeKey: 'rti',
  version: '2026-06-09',
  mapping: {
    place: 'place',
    application_date: 'applicationDate',
    applicant_name: 'applicant.name',
    applicant_address: 'applicant.address',
    applicant_is_bpl: 'applicant.isBPL',
    public_authority: 'authority.publicAuthority',
    department: 'authority.department',
    office_address: 'authority.officeAddress',
    subject: 'request.subject',
    // questions extracts as [{text}]; the convert step flattens to string[].
    questions: 'request.questions',
    fee_amount: 'fee.amount',
  },
};

registerExtractionSchema(rtiExtractionSchema, rtiFieldMap);
