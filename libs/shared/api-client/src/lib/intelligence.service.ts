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

/** Presigned URL to the original uploaded file + its metadata. */
export interface OriginalFileUrl {
  url: string;
  filename: string;
  contentType: string;
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

  /** Presigned download URL for the original uploaded file. */
  getOriginalUrl: (sourceId: string) =>
    http
      .get<OriginalFileUrl>(
        `/intelligence/sources/${sourceId}/original-url`,
      )
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

  /** Run analysis (summary/parties/obligations/risk flags + cited-law health).
   *  `force=true` bypasses the content-hash cache (Re-analyze). */
  analyze: (sourceId: string, opts?: { force?: boolean }) =>
    http
      .post<AnalysisRun>(`/intelligence/sources/${sourceId}/analyze`, {}, {
        params: opts?.force ? { force: 'true' } : undefined,
      })
      .then((r) => r.data),

  /** Get the latest analysis for a document (null if not analysed yet). */
  getAnalysis: (sourceId: string) =>
    http
      .get<AnalysisResult>(`/intelligence/sources/${sourceId}/analysis`)
      .then((r) => r.data),

  /** Ask a question about a document — page-cited answer (RAG). */
  ask: (sourceId: string, question: string) =>
    http
      .post<AskAnswer>(`/intelligence/sources/${sourceId}/ask`, { question })
      .then((r) => r.data),

  // ─── Analyse / ask on a DRAFTING document (docs/09 #6) ───────────────────

  analyzeDocument: (documentId: string, opts?: { force?: boolean }) =>
    http
      .post<AnalysisRun>(`/intelligence/documents/${documentId}/analyze`, {}, {
        params: opts?.force ? { force: 'true' } : undefined,
      })
      .then((r) => r.data),

  getDocumentAnalysis: (documentId: string) =>
    http
      .get<AnalysisResult>(`/intelligence/documents/${documentId}/analysis`)
      .then((r) => r.data),

  /** Batched analysis-presence lookup keyed by document id. */
  getDocumentsAnalysisStatus: (documentIds: string[]) =>
    http
      .post<Record<string, DocumentAnalysisStatus>>(
        '/intelligence/documents/analyze-status',
        { documentIds },
      )
      .then((r) => r.data),

  /** Submit a bulk-analysis batch to the server queue. Returns the new batch
   *  with all items in 'queued' state — workers drain it asynchronously. */
  enqueueAnalysisBatch: (documentIds: string[], opts?: { force?: boolean }) =>
    http
      .post<AnalysisQueueBatch>('/intelligence/analysis-queue', {
        documentIds,
        force: !!opts?.force,
      })
      .then((r) => r.data),

  /** Poll a single batch (items + counts + isComplete). */
  getAnalysisQueueBatch: (batchId: string) =>
    http
      .get<AnalysisQueueBatch>(`/intelligence/analysis-queue/${batchId}`)
      .then((r) => r.data),

  /** Active (or just-completed) batches — powers the queue indicator. */
  getActiveAnalysisQueue: () =>
    http
      .get<AnalysisQueueBatch[]>('/intelligence/analysis-queue/active')
      .then((r) => r.data),

  askDocument: (documentId: string, question: string) =>
    http
      .post<AskAnswer>(`/intelligence/documents/${documentId}/ask`, { question })
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

  listBatches: (q?: ListBatchesQuery) =>
    http
      .get<BatchListResult>('/intelligence/batches', { params: q })
      .then((r) => r.data),

  getBatch: (batchId: string) =>
    http
      .get<BatchDetail>(`/intelligence/batches/${batchId}`)
      .then((r) => r.data),

  /** A page of a batch's runs (server-side; docs/09 #9). */
  getBatchRuns: (batchId: string, query?: ListRunsQuery) =>
    http
      .get<BatchRunsResult>(`/intelligence/batches/${batchId}/runs`, {
        params: query,
      })
      .then((r) => r.data),

  /** Skip (archive) all archivable runs of a classified type in a batch. */
  archiveType: (batchId: string, documentTypeKey: string, reason?: string) =>
    http
      .post<{ archived: number; total: number }>(
        `/intelligence/batches/${batchId}/archive-type`,
        { documentTypeKey, reason },
      )
      .then((r) => r.data),

  /** Pipeline runs awaiting human review (paginated). Scope to one batch. */
  getReviewQueue: (batchId?: string, page = 0, pageSize = 50) =>
    http
      .get<ReviewQueueResult>('/intelligence/review-queue', {
        params: { ...(batchId ? { batch: batchId } : {}), page, pageSize },
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

export interface DocumentAnalysisStatus {
  hasAnalysis: boolean;
  lastAnalyzedAt: string | null;
  summary: string | null;
  runId: string | null;
}

export type AnalysisQueueItemStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'cached'
  | 'failed';

export interface AnalysisQueueItem {
  id: string;
  documentId: string;
  status: AnalysisQueueItemStatus;
  runId: string | null;
  error: string | null;
  force: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AnalysisQueueBatch {
  batchId: string;
  createdAt: string;
  items: AnalysisQueueItem[];
  counts: {
    queued: number;
    running: number;
    done: number;
    cached: number;
    failed: number;
    total: number;
  };
  isComplete: boolean;
}

/** Latest-analysis envelope. Same shape for sources and drafting documents
 *  (docs/09 #6). `sourceDocumentId` equals `subjectId` for source subjects. */
export interface AnalysisResult {
  subjectType?: 'source' | 'document';
  subjectId?: string;
  sourceDocumentId: string;
  analysis: AnalysisRun | null;
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
/** Workspace funnel totals (KPI tiles) — across ALL the user's runs. */
export interface BatchTotals {
  running: number;
  needsReview: number;
  completed: number;
  archived: number;
  failed: number;
}
/** A page of batches + total count + workspace funnel totals. */
export interface BatchListResult {
  items: BatchSummary[];
  total: number;
  totals: BatchTotals;
}
export interface ListBatchesQuery {
  q?: string;
  status?: 'running' | 'needs_review' | 'completed' | 'failed';
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'status' | 'created';
  dir?: 'asc' | 'desc';
}
export interface BatchRun {
  id: string;
  status: string;
  sourceDocumentId: string;
  filename: string;
  documentTypeKey: string | null;
  archivedReason: string | null;
  updatedAt: string;
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
/** Batch summary — funnel + type histogram. Runs are fetched separately,
 *  server-paginated (docs/09 #9), so a 1000-doc batch isn't shipped at once. */
export interface BatchDetail extends BatchSummary {
  funnel: BatchFunnel;
  typeHistogram: BatchTypeCount[];
}
export interface ListRunsQuery {
  status?: string;
  documentTypeKey?: string;
  openable?: boolean;
  page?: number;
  pageSize?: number;
}
export interface BatchRunsResult {
  items: BatchRun[];
  total: number;
}

export interface ReviewQueueItem {
  pipelineRunId: string;
  sourceDocumentId: string;
  filename: string;
  batchId: string | null;
  batchName: string | null;
  extractionId: string | null;
  documentTypeKey: string | null;
  overallConfidence: number | null;
  updatedAt: string;
}
export interface ReviewQueueResult {
  items: ReviewQueueItem[];
  total: number;
}

export type IntelligenceService = ReturnType<typeof createIntelligenceService>;
