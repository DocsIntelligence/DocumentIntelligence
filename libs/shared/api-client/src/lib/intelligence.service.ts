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

  // ─── Pipeline engine + batches + review queue ────────────────────────────

  /** Run a single document through a pipeline. */
  runPipeline: (sourceId: string, pipeline?: string) =>
    http
      .post<{ pipelineRunId: string; pipelineId: string }>(
        `/intelligence/sources/${sourceId}/run-pipeline`,
        {},
        { params: pipeline ? { pipeline } : {} },
      )
      .then((r) => r.data),

  /** Pipelines the user can pick to run a doc/batch through. */
  listPipelines: () =>
    http
      .get<{ key: string; name: string; version: number }[]>(
        '/intelligence/pipelines',
      )
      .then((r) => r.data),

  /** Poll a pipeline run (per-stage status). */
  getPipelineRun: (runId: string) =>
    http
      .get<PipelineRunDetail>(`/intelligence/pipeline-runs/${runId}`)
      .then((r) => r.data),

  /** Upload many files as a batch and run a pipeline over them. */
  createBatch: (
    files: File[],
    opts?: { pipeline?: string; name?: string },
  ) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const params: Record<string, string> = {};
    if (opts?.pipeline) params['pipeline'] = opts.pipeline;
    if (opts?.name) params['name'] = opts.name;
    return http
      .post<{ batchId: string; runIds: string[] }>(
        '/intelligence/batches',
        form,
        { params },
      )
      .then((r) => r.data);
  },

  listBatches: () =>
    http.get<BatchSummary[]>('/intelligence/batches').then((r) => r.data),

  getBatch: (batchId: string) =>
    http
      .get<BatchDetail>(`/intelligence/batches/${batchId}`)
      .then((r) => r.data),

  /** Pipeline runs awaiting human review. Scope to one batch when given. */
  getReviewQueue: (batchId?: string) =>
    http
      .get<ReviewQueueItem[]>('/intelligence/review-queue', {
        params: batchId ? { batch: batchId } : undefined,
      })
      .then((r) => r.data),

  /** Approve a parked run — finalize (export) with reviewed values. */
  approveRun: (runId: string) =>
    http
      .post<{ pipelineRunId: string; status: string }>(
        `/intelligence/pipeline-runs/${runId}/approve`,
        {},
      )
      .then((r) => r.data),

  /** Archive (skip) a single run — no extraction. */
  archiveRun: (runId: string, reason?: string) =>
    http
      .post<{ pipelineRunId: string; status: string }>(
        `/intelligence/pipeline-runs/${runId}/archive`,
        { reason },
      )
      .then((r) => r.data),

  /** Bulk-archive runs (e.g. skip all of a type). */
  bulkArchive: (runIds: string[], reason?: string) =>
    http
      .post<{ archived: number; total: number }>('/intelligence/runs/archive', {
        runIds,
        reason,
      })
      .then((r) => r.data),

  /** Active extraction types the user can pick from (manual override). */
  listSchemas: (ownerOrgId?: string) =>
    http
      .get<SchemaOption[]>('/intelligence/schemas', {
        params: ownerOrgId ? { ownerOrgId } : undefined,
      })
      .then((r) => r.data),

  /** Re-extract a source document as a reviewer-chosen type. */
  reprocess: (sourceDocumentId: string, schemaKey: string) =>
    http
      .post<ReprocessResult>(
        `/intelligence/sources/${sourceDocumentId}/reprocess`,
        { schemaKey },
      )
      .then((r) => r.data),
});

export interface SchemaOption {
  key: string;
  name: string;
  documentTypeKey?: string;
}

export interface ReprocessResult {
  extractionId: string;
  schemaKey: string;
  documentTypeKey: string | null;
  pipelineRunId: string | null;
  status: 'needs_review';
}

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

// ─── Pipeline engine + batches + review queue (docs/07) ─────────────────────

export interface PipelineRunStageStatus {
  stageType: string;
  status: string;
  score: number | null;
  error: string | null;
}
export interface PipelineRunDetail {
  id: string;
  status: string;
  currentStageId: string | null;
  error: string | null;
  sourceDocumentId: string;
  stages: PipelineRunStageStatus[];
}

export interface BatchSummary {
  id: string;
  name: string | null;
  status: 'running' | 'needs_review' | 'completed' | 'failed';
  total: number;
  completed: number;
  needsReview: number;
  failed: number;
  archived: number;
  running: number;
  createdAt: string;
}
export interface BatchRun {
  id: string;
  status: string;
  sourceDocumentId: string;
  filename: string;
  documentTypeKey: string | null;
  archivedReason: string | null;
}
export interface BatchFunnel {
  inProgress: number;
  needsReview: number;
  completed: number;
  archived: number;
  failed: number;
}
export interface BatchTypeCount {
  documentTypeKey: string;
  count: number;
}
export interface BatchDetail extends BatchSummary {
  funnel: BatchFunnel;
  typeHistogram: BatchTypeCount[];
  runs: BatchRun[];
}

export interface ReviewQueueItem {
  pipelineRunId: string;
  sourceDocumentId: string;
  filename: string;
  batchId: string | null;
  extractionId: string | null;
  documentTypeKey: string | null;
  overallConfidence: number | null;
}

export type IntelligenceService = ReturnType<typeof createIntelligenceService>;
