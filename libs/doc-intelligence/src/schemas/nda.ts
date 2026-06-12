/**
 * NDA ExtractionSchema + FieldMap — bridges a reviewed NDA extraction onto the
 * structured `ndaBundle` in `@org/document-schema` so convert produces a proper
 * templated NDA (recitals + numbered clauses), not a freeform field dump.
 *
 * The extraction captures prose clauses (definition, obligations, remedies…),
 * but the structured template AUTHORS that clause language deterministically.
 * So the FieldMap deliberately carries only the clean scalar values the
 * structured doc needs — parties, addresses, dates, purpose, governing law —
 * and lets unmapped clause-text fields fall away. Field keys mirror the
 * read-only `nda` extraction catalog (camelCase) so classification is consistent.
 */

import type { FieldMap } from '../field-map';
import type { ExtractionSchema } from '../types';
import { registerExtractionSchema } from './_registry';

export const ndaExtractionSchema: ExtractionSchema = {
  key: 'nda',
  name: 'Non-Disclosure Agreement',
  version: '2026-06-12',
  documentTypeKey: 'nda',
  description:
    'A contract in which one or both parties agree to protect confidential information shared during a business relationship.',
  fields: [
    { key: 'documentTitle', label: 'Document Title', type: 'string' },
    { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
    { key: 'ndaType', label: 'NDA Type (unilateral, bilateral/mutual)', type: 'string' },
    { key: 'disclosingParty', label: 'Disclosing Party Name and Contact', type: 'string' },
    { key: 'disclosingPartyAddress', label: 'Disclosing Party Address', type: 'string' },
    { key: 'receivingParty', label: 'Receiving Party Name and Contact', type: 'string' },
    { key: 'receivingPartyAddress', label: 'Receiving Party Address', type: 'string' },
    { key: 'purposeOfDisclosure', label: 'Purpose of Disclosure', type: 'string' },
    { key: 'definitionOfConfidentialInformation', label: 'Definition of Confidential Information', type: 'string' },
    { key: 'exclusionsFromConfidentialInformation', label: 'Exclusions from Confidential Information', type: 'string' },
    { key: 'obligationsOfReceivingParty', label: 'Obligations of Receiving Party', type: 'string' },
    { key: 'permittedDisclosures', label: 'Permitted Disclosures', type: 'string' },
    { key: 'confidentialityTerm', label: 'Confidentiality Term / Duration', type: 'string' },
    { key: 'returnOrDestruction', label: 'Return or Destruction of Confidential Information', type: 'string' },
    { key: 'remediesForBreach', label: 'Remedies for Breach', type: 'string' },
    { key: 'nonSolicitationClause', label: 'Non-Solicitation Clause (if applicable)', type: 'string' },
    { key: 'residualKnowledgeClause', label: 'Residual Knowledge Clause (if applicable)', type: 'string' },
    { key: 'governingLaw', label: 'Governing Law / Jurisdiction', type: 'string' },
    { key: 'disputeResolution', label: 'Dispute Resolution', type: 'string' },
    { key: 'signatureBlocks', label: 'Signature Blocks (name, title, date)', type: 'string' },
  ],
};

/**
 * extractionKey → ndaBundle dot-path. Only clean scalars are mapped; prose
 * clause fields (definition/obligations/remedies/etc.) and the free-text
 * dispute-resolution/ndaType are intentionally omitted — the structured
 * template supplies that language, and the user adjusts via the form.
 */
export const ndaFieldMap: FieldMap = {
  schemaKey: 'nda',
  documentTypeKey: 'nda',
  version: '2026-06-12',
  mapping: {
    effectiveDate: 'agreement.effectiveDate',
    purposeOfDisclosure: 'agreement.purpose',
    disclosingParty: 'partyA.name',
    disclosingPartyAddress: 'partyA.address',
    receivingParty: 'partyB.name',
    receivingPartyAddress: 'partyB.address',
    governingLaw: 'governing.state',
  },
};

registerExtractionSchema(ndaExtractionSchema, ndaFieldMap);
