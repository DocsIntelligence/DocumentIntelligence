/**
 * @org/doc-intelligence — pure, testable core for Document Intelligence
 * (docs/05). Types + engine contracts + schema→JSON-Schema + prompt builders +
 * confidence routing + the eval harness + the convert field-map. No React, no
 * NestJS, no provider SDKs — concrete engines (vision LLM, OCR) live in the API
 * `intelligence` module and register against the contracts exported here.
 */

export * from './types';
export * from './engines';
export * from './field-map';
export {
  buildJsonSchema,
  buildExtractionToolSchema,
  buildClassificationSchema,
} from './json-schema';
export {
  PROMPT_VERSION,
  buildExtractPrompt,
  buildClassifyPrompt,
  buildCriticPrompt,
} from './prompts';
export {
  lowConfidenceFields,
  subSchema,
  mergeCritic,
} from './critic';
export {
  buildAnalysisPrompt,
  buildAnalysisSchema,
  type AnalysisData,
  type AnalysisParty,
  type AnalysisDate,
  type AnalysisObligation,
  type AnalysisRiskFlag,
} from './analysis';
export {
  chunkPages,
  cosineSimilarity,
  topKChunks,
  buildAskPrompt,
  type TextChunk,
  type EmbeddedChunk,
  type RetrievedChunk,
} from './rag';
export {
  DEFAULT_ROUTING,
  computeOverallConfidence,
  decideReview,
  type RoutingPolicy,
  type ReviewDecision,
} from './confidence';
export * from './eval';
export {
  registerExtractionSchema,
  getExtractionSchema,
  getFieldMap,
  listExtractionSchemaKeys,
  classifierCandidateKeys,
} from './schemas/_registry';

// Eagerly register the first packs — the three live document types
// (rent/rti/legal-notice) plus a generic fallback.
import './schemas/rent-agreement';
import './schemas/rti';
import './schemas/legal-notice';
import './schemas/generic';

export {
  rentAgreementExtractionSchema,
  rentAgreementFieldMap,
} from './schemas/rent-agreement';
export { rtiExtractionSchema, rtiFieldMap } from './schemas/rti';
export {
  legalNoticeExtractionSchema,
  legalNoticeFieldMap,
} from './schemas/legal-notice';
export { genericExtractionSchema } from './schemas/generic';
