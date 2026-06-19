export {
  IN_ALL,
  JURISDICTIONS,
  getJurisdiction,
  jurisdictionName,
  type Jurisdiction,
} from './lib/jurisdictions';

export {
  CRIMINAL_CODE_REFORMS,
  CRIMINAL_CODE_REFORM_NOTE,
  CITATIONS,
  getCitation,
  citationsForTopic,
  formatCitation,
  reformRemaps,
  type Citation,
  type CitationConfidence,
  type CodeReform,
  type RepealedCode,
  type ReformRemap,
} from './lib/citations';

export {
  DOCUMENT_PRESETS,
  getDocumentPreset,
  type DocumentPreset,
  type DocumentPresetCategory,
} from './lib/document-presets';

export {
  buildSignatureBlockHtml,
  buildSignatureAuditHtml,
  appendSignaturesToHtml,
  type SignatureSignerInput,
} from './lib/signature-block';

export {
  SCHEDULE_1_EXCLUSIONS,
  SCHEDULE_1_NOTE,
  ESIGN_EXCLUDED_KEYS,
  isESignExcluded,
  type Schedule1Exclusion,
} from './lib/schedule1';

export {
  validateCitations,
  citationWarnings,
  type CitationFinding,
} from './lib/citation-validator';
