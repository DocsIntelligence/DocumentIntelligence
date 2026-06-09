import type {
  EngineMode,
  IntelligenceJob,
  SaveReviewPayload,
} from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
