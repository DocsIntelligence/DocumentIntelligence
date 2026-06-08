import type {
  AddSignerPayload,
  CreateDocumentPayload,
  CreateSharePayload,
  DocumentDetail,
  PatchDocumentPayload,
  RecordSignaturePayload,
  UpdateSignerPayload,
} from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDocumentsService, useSharesService } from './services-context';

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

export function useDocumentVersions(id: string, enabled = true) {
  const svc = useDocumentsService();
  return useQuery({
    queryKey: ['documents', 'versions', id],
    queryFn: () => svc.listVersions(id),
    enabled: enabled && !!id,
  });
}

export function useSnapshotDocument(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (label?: string) => svc.snapshot(id, label),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'versions', id] });
      toast.success('Version saved');
    },
    onError: (err) =>
      toast.error(extractMessage(err, 'Could not save version')),
  });
}

export function useRestoreVersion(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => svc.restoreVersion(id, versionId),
    onSuccess: (doc: DocumentDetail) => {
      qc.setQueryData(documentsKeys.detail(id), doc);
      qc.invalidateQueries({ queryKey: ['documents', 'versions', id] });
      toast.success('Restored to selected version');
    },
    onError: (err) => toast.error(extractMessage(err, 'Restore failed')),
  });
}

export function useComments(id: string, enabled = true) {
  const svc = useDocumentsService();
  return useQuery({
    queryKey: ['documents', 'comments', id],
    queryFn: () => svc.listComments(id),
    enabled: enabled && !!id,
  });
}

export function useAddComment(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => svc.addComment(id, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['documents', 'comments', id] }),
    onError: (err) => toast.error(extractMessage(err, 'Could not add comment')),
  });
}

export function useResolveComment(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { commentId: string; resolved: boolean }) =>
      svc.resolveComment(id, args.commentId, args.resolved),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['documents', 'comments', id] }),
  });
}

export function useSigners(id: string, enabled = true) {
  const svc = useDocumentsService();
  return useQuery({
    queryKey: ['documents', 'signers', id],
    queryFn: () => svc.listSigners(id),
    enabled: enabled && !!id,
  });
}

export function useAddSigner(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddSignerPayload) => svc.addSigner(id, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['documents', 'signers', id] }),
    onError: (err) => toast.error(extractMessage(err, 'Could not add signer')),
  });
}

export function useUpdateSigner(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { signerId: string; payload: UpdateSignerPayload }) =>
      svc.updateSigner(id, args.signerId, args.payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['documents', 'signers', id] }),
    onError: (err) =>
      toast.error(extractMessage(err, 'Could not update signer')),
  });
}

export function useRemoveSigner(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (signerId: string) => svc.removeSigner(id, signerId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['documents', 'signers', id] }),
    onError: (err) =>
      toast.error(extractMessage(err, 'Could not remove signer')),
  });
}

export function useSignSigner(id: string) {
  const svc = useDocumentsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { signerId: string; payload: RecordSignaturePayload }) =>
      svc.signSigner(id, args.signerId, args.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', 'signers', id] });
      // Document status may flip to 'signed' once everyone has signed.
      qc.invalidateQueries({ queryKey: ['documents', 'detail', id] });
    },
    onError: (err) =>
      toast.error(extractMessage(err, 'Could not save signature')),
  });
}

export function useCreateShare() {
  const shares = useSharesService();
  return useMutation({
    mutationFn: (payload: CreateSharePayload) => shares.create(payload),
    onError: (err) => toast.error(extractMessage(err, 'Could not create link')),
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
