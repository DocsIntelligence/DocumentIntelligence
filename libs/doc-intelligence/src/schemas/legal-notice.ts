/**
 * Legal Notice ExtractionSchema (docs/05 §5.5, §11.4) — co-designed with
 * `@org/document-schema`'s `legalNoticeBundle`. The FieldMap routes flat
 * extraction keys onto the bundle's nested Zod paths for structured convert.
 */

import type { FieldMap } from '../field-map';
import type { ExtractionSchema } from '../types';
import { registerExtractionSchema } from './_registry';

export const legalNoticeExtractionSchema: ExtractionSchema = {
  key: 'legal_notice',
  name: 'Legal Notice',
  version: '2026-06-09',
  documentTypeKey: 'legal_notice',
  description: 'A legal/demand notice (cheque bounce, consumer, recovery, etc.).',
  fields: [
    {
      key: 'notice_type',
      label: 'Notice type',
      type: 'enum',
      enumValues: ['cheque_bounce', 'consumer', 'civil_recovery', 'employment', 'general'],
    },
    { key: 'notice_date', label: 'Date of notice', type: 'date', format: 'DD/MM/YYYY' },
    { key: 'place', label: 'Place', type: 'string' },
    { key: 'sender_name', label: 'Sender — name', type: 'string', required: true },
    { key: 'sender_address', label: 'Sender — address', type: 'string' },
    { key: 'recipient_name', label: 'Recipient — name', type: 'string', required: true },
    { key: 'recipient_address', label: 'Recipient — address', type: 'string' },
    { key: 'advocate_name', label: 'Advocate — name', type: 'string' },
    { key: 'subject', label: 'Subject', type: 'string', required: true },
    {
      key: 'facts',
      label: 'Facts / background',
      type: 'table',
      description: 'Each numbered factual statement in the notice.',
      columns: [{ key: 'text', label: 'Fact', type: 'string' }],
    },
    { key: 'demand_text', label: 'Demand', type: 'string' },
    { key: 'demand_amount', label: 'Amount demanded (₹)', type: 'currency', format: 'INR' },
    { key: 'compliance_days', label: 'Compliance period (days)', type: 'number' },
    // Cheque-bounce specifics (present only for that notice type).
    { key: 'cheque_number', label: 'Cheque number', type: 'string' },
    { key: 'cheque_amount', label: 'Cheque amount (₹)', type: 'currency', format: 'INR' },
    { key: 'cheque_bank', label: 'Cheque bank', type: 'string' },
  ],
};

export const legalNoticeFieldMap: FieldMap = {
  schemaKey: 'legal_notice',
  documentTypeKey: 'legal_notice',
  version: '2026-06-09',
  mapping: {
    notice_type: 'noticeType',
    notice_date: 'noticeDate',
    place: 'place',
    sender_name: 'sender.name',
    sender_address: 'sender.address',
    recipient_name: 'recipient.name',
    recipient_address: 'recipient.address',
    advocate_name: 'advocate.name',
    subject: 'content.subject',
    facts: 'content.facts',
    demand_text: 'content.demandText',
    demand_amount: 'content.demandAmount',
    compliance_days: 'content.complianceDays',
    cheque_number: 'cheque.number',
    cheque_amount: 'cheque.amount',
    cheque_bank: 'cheque.bankName',
  },
};

registerExtractionSchema(legalNoticeExtractionSchema, legalNoticeFieldMap);
