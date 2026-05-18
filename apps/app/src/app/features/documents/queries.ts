import type {
  CreateDocumentPayload,
  DocumentDetail,
  PatchDocumentPayload,
} from '@org/api-client';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDocumentsService } from './services-context';

export const documentsKeys = {
  all: ['documents'] as const,
  catalog: ['documents', 'catalog'] as const,
  list: () => ['documents', 'list'] as const,
  detail: (id: string) => ['documents', 'detail', id] as const,
};

export function useDocumentCatalog() {
  const svc = useDocumentsService();
  return useQuery({
    queryKey: documentsKeys.catalog,
    queryFn: () => svc.catalog(),
    staleTime: 5 * 60_000,
  });
}

export function useDocumentList() {
  const svc = useDocumentsService();
  return useQuery({
    queryKey: documentsKeys.list(),
    queryFn: () => svc.list({ limit: 50 }),
  });
}

export function useDocument(id: string | undefined) {
  const svc = useDocumentsService();
  return useQuery({
    queryKey: id ? documentsKeys.detail(id) : ['documents', 'detail', 'none'],
    queryFn: () => svc.get(id as string),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDocumentPayload) => svc.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
    onError: (err) => toast.error(extractMessage(err, 'Failed to create')),
  });
}

export function usePatchDocument(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchDocumentPayload) => svc.patch(id, payload),
    onSuccess: (doc: DocumentDetail) => {
      qc.setQueryData(documentsKeys.detail(id), doc);
    },
    onError: (err) => toast.error(extractMessage(err, 'Autosave failed')),
  });
}

export function useDeleteDocument() {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKeys.all }),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────

function extractMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'message' in err.response.data
  ) {
    const msg = (err.response.data as { message: unknown }).message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg)) return msg.join(', ');
  }
  return fallback;
}
