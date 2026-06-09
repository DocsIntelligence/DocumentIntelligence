import type { HttpClient } from './http';

/**
 * Document Intelligence service (docs/05). Upload an existing document → it is
 * classified + extracted asynchronously → poll the job → read / correct the
 * extraction. Backed by the `/intelligence/*` API (JWT-guarded).
 */

export type EngineMode = 'auto' | 'native' | 'vlm' | 'agentic';

export type IntelligenceJobStatus =
  | 'queued'
  | 'processing'
  | 'needs_review'
  | 'completed'
  | 'failed';

export interface StartResult {
  sourceDocumentId: string;
  jobId: string;
}

export interface IntelligenceJob {
  id: string;
  status: IntelligenceJobStatus;
  stage: string;
  documentTypeKey: string | null;
  error: string | null;
  attempts: number;
  sourceDocumentId: string;
  extractionId: string | null;
  overallConfidence: number | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Per-field confidence + provenance (page-level for the MVP). */
export interface FieldConfidence {
  confidence: number;
  provenance?: {
    page?: number;
    source?: 'native_text' | 'ocr' | 'vlm';
    snippet?: string;
  };
}

/** The review routing decision computed server-side. */
export interface ReviewDecision {
  needsReview: boolean;
  flaggedFields: string[];
  reasons: string[];
}

/** Minimal mirror of an ExtractionSchema field (for rendering the review form). */
export interface ExtractionFieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
  enumValues?: string[];
}

export interface ExtractionSchemaDef {
  key: string;
  name: string;
  version: string;
  documentTypeKey?: string;
  fields: ExtractionFieldDef[];
}

export interface ExtractionDetail {
  id: string;
  schemaKey: string;
  documentTypeKey: string | null;
  fields: Record<string, unknown>;
  confidence: Record<string, FieldConfidence>;
  overallConfidence: number;
  reviewed: boolean;
  review: ReviewDecision;
  schema: ExtractionSchemaDef;
}

export interface ExtractionResponse {
  sourceDocumentId: string;
  extraction: ExtractionDetail | null;
}

export interface SaveReviewPayload {
  fields: Record<string, unknown>;
  edits: { fieldPath: string; newValue: unknown }[];
  markReviewed?: boolean;
}

export const createIntelligenceService = (http: HttpClient) => ({
  /** Multipart upload + start extraction. `engine` selects the tier (auto default). */
  upload: (file: File, opts?: { ownerOrgId?: string; engine?: EngineMode }) => {
    const form = new FormData();
    form.append('file', file);
    const params: Record<string, string> = {};
    if (opts?.ownerOrgId) params['ownerOrgId'] = opts.ownerOrgId;
    if (opts?.engine) params['engine'] = opts.engine;
    return http
      .post<StartResult>('/intelligence/upload', form, { params })
      .then((r) => r.data);
  },

  /** Poll a job's status. */
  getJob: (jobId: string) =>
    http
      .get<IntelligenceJob>(`/intelligence/jobs/${jobId}`)
      .then((r) => r.data),

  /** Get the latest extraction for a source document (fields + confidence). */
  getExtraction: (sourceId: string) =>
    http
      .get<ExtractionResponse>(`/intelligence/sources/${sourceId}/extraction`)
      .then((r) => r.data),

  /** Save reviewed/corrected values (records an edit audit trail server-side). */
  saveReview: (extractionId: string, payload: SaveReviewPayload) =>
    http
      .post<{ id: string; reviewed: boolean }>(
        `/intelligence/extractions/${extractionId}/review`,
        payload,
      )
      .then((r) => r.data),

  /** Create an editable Document from the reviewed extraction (convert bridge). */
  convert: (extractionId: string) =>
    http
      .post<ConvertResult>(
        `/intelligence/extractions/${extractionId}/convert`,
        {},
      )
      .then((r) => r.data),

  /** Run analysis (summary/parties/obligations/risk flags + cited-law health). */
  analyze: (sourceId: string) =>
    http
      .post<AnalysisRun>(`/intelligence/sources/${sourceId}/analyze`, {})
      .then((r) => r.data),

  /** Get the latest analysis for a document (null if not analysed yet). */
  getAnalysis: (sourceId: string) =>
    http
      .get<{ sourceDocumentId: string; analysis: AnalysisRun | null }>(
        `/intelligence/sources/${sourceId}/analysis`,
      )
      .then((r) => r.data),

  /** Ask a question about a document — page-cited answer (RAG). */
  ask: (sourceId: string, question: string) =>
    http
      .post<AskAnswer>(`/intelligence/sources/${sourceId}/ask`, { question })
      .then((r) => r.data),
});

export interface ConvertResult {
  documentId: string;
  mode: 'structured' | 'freeform';
}

// ─── Phase 2: analysis + Q&A ────────────────────────────────────────────────

export interface CitationFinding {
  matched: string;
  code: 'IPC' | 'CrPC' | 'Evidence Act';
  section?: string;
  severity: 'warning';
  message: string;
  suggestion?: string;
}

export interface AnalysisRun {
  id: string;
  summary: string | null;
  parties: { name: string; role?: string }[] | null;
  keyDates: { label: string; date?: string }[] | null;
  obligations: { party?: string; obligation: string }[] | null;
  riskFlags: { severity: 'low' | 'medium' | 'high'; note: string }[] | null;
  citationFindings: CitationFinding[] | null;
  createdAt: string;
}

export interface AskAnswer {
  answer: string;
  citations: { page: number; snippet: string; score: number }[];
}

export type IntelligenceService = ReturnType<typeof createIntelligenceService>;
