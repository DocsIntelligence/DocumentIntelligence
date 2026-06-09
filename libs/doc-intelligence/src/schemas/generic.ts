/**
 * Generic fallback ExtractionSchema — used when the classifier matches no known
 * `DocumentType`. It has NO `documentTypeKey`, so convert (Phase 3) routes its
 * result to a freeform `Document` rather than a structured prefill (§11.3).
 * Deliberately small + universal: enough to summarize an unknown legal doc.
 */

import type { ExtractionSchema } from '../types';
import { registerExtractionSchema } from './_registry';

export const genericExtractionSchema: ExtractionSchema = {
  key: 'generic_document',
  name: 'Generic Document',
  version: '2026-06-09',
  description: 'A document of unknown/unsupported type — best-effort key facts.',
  fields: [
    { key: 'document_title', label: 'Document title / heading', type: 'string' },
    { key: 'document_date', label: 'Date on the document', type: 'date' },
    { key: 'parties', label: 'Parties / names mentioned', type: 'string', description: 'Comma-separated party names.' },
    { key: 'place', label: 'Place / jurisdiction', type: 'string' },
    { key: 'summary', label: 'One-paragraph summary', type: 'string' },
  ],
};

registerExtractionSchema(genericExtractionSchema);
