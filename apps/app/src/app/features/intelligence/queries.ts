import type {
  EngineMode,
  IntelligenceJob,
  ListBatchesQuery,
  SaveReviewPayload,
} from '@org/api-client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useIntelligenceService } from '../documents/services-context';

export const intelligenceKeys = {
  all: ['intelligence'] as const,
  job: (id: string) => ['intelligence', 'job', id] as const,
  extraction: (sourceId: string) =>
    ['intelligence', 'extraction', sourceId] as const,
  analysis: (sourceId: string) =>
    ['intelligence', 'analysis', sourceId] as const,
  batches: ['intelligence', 'batches'] as const,
  batchPage: (params: ListBatchesQuery) =>
    ['intelligence', 'batches', params] as const,
  batch: (id: string) => ['intelligence', 'batch', id] as const,
  reviewQueue: ['intelligence', 'review-queue'] as const,
  pipelines: ['intelligence', 'pipelines'] as const,
  schemas: ['intelligence', 'schemas'] as const,
};

function extractMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}

/** Upload a file and start an extraction job. */
export function useUploadDocument() {
  const svc = useIntelligenceService();
  return useMutation({
    mutationFn: (vars: { file: File; engine?: EngineMode }) =>
      svc.upload(vars.file, { engine: vars.engine }),
    onError: (err) =>
      toast.error(extractMessage(err, 'Upload failed. Please try again.')),
  });
}

/** Poll a job until it reaches a terminal state. */
export function useIntelligenceJob(jobId: string | undefined) {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: jobId ? intelligenceKeys.job(jobId) : ['intelligence', 'job', 'none'],
    queryFn: () => svc.getJob(jobId as string),
    enabled: !!jobId,
    // Poll every 2s while the job is still running; stop once terminal.
    refetchInterval: (query) => {
      const status = (query.state.data as IntelligenceJob | undefined)?.status;
      return status === 'queued' || status === 'processing' ? 2000 : false;
    },
  });
}

/** Load the latest extraction for a source document. */
export function useExtraction(sourceId: string | undefined, enabled = true) {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: sourceId
      ? intelligenceKeys.extraction(sourceId)
      : ['intelligence', 'extraction', 'none'],
    queryFn: () => svc.getExtraction(sourceId as string),
    enabled: !!sourceId && enabled,
  });
}

/** Latest analysis for a document (null until analyzed). */
export function useAnalysis(sourceId: string | undefined) {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: sourceId
      ? intelligenceKeys.analysis(sourceId)
      : ['intelligence', 'analysis', 'none'],
    queryFn: () => svc.getAnalysis(sourceId as string),
    enabled: !!sourceId,
  });
}

/** Run (or re-run) analysis for a document. */
export function useRunAnalysis(sourceId: string) {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => svc.analyze(sourceId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: intelligenceKeys.analysis(sourceId) }),
    onError: (err) => toast.error(extractMessage(err, 'Analysis failed')),
  });
}

/** Ask a question about a document (RAG, page-cited). */
export function useAsk(sourceId: string) {
  const svc = useIntelligenceService();
  return useMutation({
    mutationFn: (question: string) => svc.ask(sourceId, question),
    onError: (err) => toast.error(extractMessage(err, 'Could not answer')),
  });
}

// ─── Batches + review queue (docs/07) ──────────────────────────────────────

export function useCreateBatch() {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { files: File[]; name?: string; pipeline?: string }) =>
      svc.createBatch(vars.files, { name: vars.name, pipeline: vars.pipeline }),
    onSuccess: () => qc.invalidateQueries({ queryKey: intelligenceKeys.batches }),
    onError: (err) => toast.error(extractMessage(err, 'Batch upload failed')),
  });
}

/** Pipelines the user can choose to run a batch/document through. */
export function usePipelineOptions() {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: intelligenceKeys.pipelines,
    queryFn: () => svc.listPipelines(),
  });
}

export function useBatches(params: ListBatchesQuery = {}) {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: intelligenceKeys.batchPage(params),
    queryFn: () => svc.listBatches(params),
    refetchInterval: 5000, // batches progress while runs process
    placeholderData: keepPreviousData,
  });
}

export function useBatch(batchId: string | undefined) {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: batchId ? intelligenceKeys.batch(batchId) : ['intelligence', 'batch', 'none'],
    queryFn: () => svc.getBatch(batchId as string),
    enabled: !!batchId,
    refetchInterval: (q) => {
      const data = q.state.data as { status?: string } | undefined;
      return data?.status === 'running' ? 3000 : false;
    },
  });
}

/** Review queue, optionally scoped to a single batch. */
export function useReviewQueue(batchId?: string) {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: [...intelligenceKeys.reviewQueue, batchId ?? 'all'],
    queryFn: () => svc.getReviewQueue(batchId),
  });
}

export function useApproveRun(batchId?: string) {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => svc.approveRun(runId),
    onSuccess: () => {
      // Prefix match invalidates every scoped review-queue key too.
      qc.invalidateQueries({ queryKey: intelligenceKeys.reviewQueue });
      qc.invalidateQueries({ queryKey: intelligenceKeys.batches });
      if (batchId)
        qc.invalidateQueries({ queryKey: intelligenceKeys.batch(batchId) });
      toast.success('Approved & finalized');
    },
    onError: (err) => toast.error(extractMessage(err, 'Approval failed')),
  });
}

/** Archive (skip) a single run — the per-document skip control. */
export function useArchiveRun(batchId?: string) {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { runId: string; reason?: string }) =>
      svc.archiveRun(vars.runId, vars.reason),
    onSuccess: () => {
      if (batchId)
        qc.invalidateQueries({ queryKey: intelligenceKeys.batch(batchId) });
      qc.invalidateQueries({ queryKey: intelligenceKeys.reviewQueue });
      qc.invalidateQueries({ queryKey: intelligenceKeys.batches });
      toast.success('Archived (skipped)');
    },
    onError: (err) => toast.error(extractMessage(err, 'Archive failed')),
  });
}

/** Bulk-archive runs (e.g. skip all of a type). */
export function useBulkArchive(batchId?: string) {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { runIds: string[]; reason?: string }) =>
      svc.bulkArchive(vars.runIds, vars.reason),
    onSuccess: (res) => {
      if (batchId)
        qc.invalidateQueries({ queryKey: intelligenceKeys.batch(batchId) });
      qc.invalidateQueries({ queryKey: intelligenceKeys.batches });
      toast.success(`Archived ${res.archived} of ${res.total}`);
    },
    onError: (err) => toast.error(extractMessage(err, 'Bulk archive failed')),
  });
}

/** Active extraction types the user can pick from (manual type override). */
export function useSchemaOptions() {
  const svc = useIntelligenceService();
  return useQuery({
    queryKey: intelligenceKeys.schemas,
    queryFn: () => svc.listSchemas(),
    staleTime: 5 * 60 * 1000, // config-ish; rarely changes mid-session
  });
}

/**
 * Re-extract a source as a chosen type, then refresh the review/batch views.
 * `sourceId` invalidates the extraction so the corrected type shows immediately.
 */
export function useReprocess(sourceId: string, batchId?: string) {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schemaKey: string) => svc.reprocess(sourceId, schemaKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: intelligenceKeys.extraction(sourceId) });
      qc.invalidateQueries({ queryKey: intelligenceKeys.reviewQueue });
      qc.invalidateQueries({ queryKey: intelligenceKeys.batches });
      if (batchId)
        qc.invalidateQueries({ queryKey: intelligenceKeys.batch(batchId) });
      toast.success('Re-processing as the chosen type');
    },
    onError: (err) => toast.error(extractMessage(err, 'Re-process failed')),
  });
}

/**
 * Reprocess variant for list contexts (batch rows) where the source id is
 * known only at call time. Same effect as {@link useReprocess}.
 */
export function useReprocessRun(batchId?: string) {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { sourceDocumentId: string; schemaKey: string }) =>
      svc.reprocess(vars.sourceDocumentId, vars.schemaKey),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({
        queryKey: intelligenceKeys.extraction(vars.sourceDocumentId),
      });
      qc.invalidateQueries({ queryKey: intelligenceKeys.reviewQueue });
      qc.invalidateQueries({ queryKey: intelligenceKeys.batches });
      if (batchId)
        qc.invalidateQueries({ queryKey: intelligenceKeys.batch(batchId) });
      toast.success('Re-processing as the chosen type');
    },
    onError: (err) => toast.error(extractMessage(err, 'Re-process failed')),
  });
}

/** Convert a reviewed extraction into an editable Document (Phase 3 bridge). */
export function useConvert() {
  const svc = useIntelligenceService();
  return useMutation({
    mutationFn: (extractionId: string) => svc.convert(extractionId),
    onError: (err) =>
      toast.error(extractMessage(err, 'Failed to create document')),
  });
}

/** Save reviewed/corrected extraction values. */
export function useSaveReview(extractionId: string, sourceId: string) {
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveReviewPayload) =>
      svc.saveReview(extractionId, payload),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: intelligenceKeys.extraction(sourceId),
      });
      toast.success('Review saved');
    },
    onError: (err) => toast.error(extractMessage(err, 'Failed to save review')),
  });
}
