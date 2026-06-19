import type {
  CreateVaultEntityPayload,
  ListVaultEntitiesQuery,
  RecordVaultSignaturePayload,
  UpdateVaultEntityPayload,
} from '@org/api-client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVaultService } from '../documents/services-context';

export const vaultKeys = {
  all: ['vault'] as const,
  list: ['vault', 'entities'] as const,
  page: (params: ListVaultEntitiesQuery) =>
    ['vault', 'entities', params] as const,
  entity: (id: string) => ['vault', 'entity', id] as const,
  entityKinds: ['vault', 'entity-kinds'] as const,
  signatures: ['vault', 'signatures'] as const,
};

/** Active entity kinds the user can create — DB-driven, falls back to
 *  the static KNOWN_VAULT_KINDS on query failure. */
export function useVaultEntityKindsActive() {
  const svc = useVaultService();
  return useQuery({
    queryKey: vaultKeys.entityKinds,
    queryFn: () => svc.entityKinds(),
    staleTime: 60_000,
  });
}

export function useVaultEntities(params: ListVaultEntitiesQuery = {}) {
  const svc = useVaultService();
  return useQuery({
    queryKey: vaultKeys.page(params),
    queryFn: () => svc.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useVaultEntity(id: string | undefined) {
  const svc = useVaultService();
  return useQuery({
    queryKey: id ? vaultKeys.entity(id) : ['vault', 'entity', 'none'],
    queryFn: () => svc.get(id as string),
    enabled: !!id,
  });
}

export function useCreateVaultEntity() {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVaultEntityPayload) => svc.create(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.list });
      toast.success('Entity saved');
    },
    onError: (err) => toast.error(extractMessage(err, 'Could not save entity')),
  });
}

export function useUpdateVaultEntity(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateVaultEntityPayload) => svc.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.entity(id) });
      void qc.invalidateQueries({ queryKey: vaultKeys.list });
      toast.success('Saved');
    },
    onError: (err) => toast.error(extractMessage(err, 'Could not save')),
  });
}

export function useDuplicateVaultEntity() {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.duplicate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.list });
      toast.success('Entity duplicated');
    },
    onError: (err) => toast.error(extractMessage(err, 'Could not duplicate')),
  });
}

export function useDeleteVaultEntity() {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.list });
      toast.success('Entity deleted');
    },
    onError: (err) => toast.error(extractMessage(err, 'Could not delete')),
  });
}

export function useAddVaultDocument(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File; kind: string }) =>
      svc.addDocument(id, vars.file, vars.kind),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.entity(id) });
      toast.success('Document attached');
    },
    onError: (err) => toast.error(extractMessage(err, 'Upload failed')),
  });
}

/** Scan a document and merge the suggested values into the entity (empty fields
 *  only, so existing data is never overwritten). */
export function useScanVaultDocument(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      const { suggestions } = await svc.scanDocument(id, docId);
      const keys = Object.keys(suggestions);
      if (keys.length === 0) return { added: 0 };
      const revealed = await svc.reveal(id);
      const merged = { ...revealed.fields };
      let added = 0;
      for (const [k, v] of Object.entries(suggestions)) {
        if (!merged[k] || !merged[k].trim()) {
          merged[k] = v;
          added++;
        }
      }
      if (added > 0) await svc.update(id, { fields: merged });
      return { added };
    },
    onSuccess: ({ added }) => {
      void qc.invalidateQueries({ queryKey: vaultKeys.entity(id) });
      toast.success(
        added > 0 ? `Filled ${added} field(s) from the document` : 'Nothing new to fill',
      );
    },
    onError: () =>
      toast.error('Scan failed — needs a vision-capable AI provider (e.g. ANTHROPIC_API_KEY)'),
  });
}

/** Bulk: upload many KYC docs → classify + extract + attach + autofill (server). */
export function useBulkScanVaultDocuments(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => svc.bulkScanDocuments(id, files),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: vaultKeys.entity(id) });
      const ok = res.results.filter((r) => r.status === 'scanned').length;
      const failed = res.results.length - ok;
      toast.success(
        `Scanned ${ok} doc(s), filled ${res.filledCount} field(s)` +
          (failed > 0 ? ` · ${failed} failed` : ''),
      );
    },
    onError: () =>
      toast.error(
        'Bulk scan failed — needs a vision-capable AI provider (e.g. ANTHROPIC_API_KEY)',
      ),
  });
}

export function useRemoveVaultDocument(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => svc.removeDocument(id, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entity(id) }),
    onError: (err) => toast.error(extractMessage(err, 'Could not remove document')),
  });
}

// ── Signatures ─────────────────────────────────────────────────────────────

/** All the user's saved signatures across entities — for the signing picker. */
export function useAllVaultSignatures(enabled = true) {
  const svc = useVaultService();
  return useQuery({
    queryKey: vaultKeys.signatures,
    queryFn: () => svc.allSignatures(),
    enabled,
    staleTime: 30_000,
  });
}

export function useAddVaultSignature(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordVaultSignaturePayload) =>
      svc.addSignature(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.entity(id) });
      void qc.invalidateQueries({ queryKey: vaultKeys.signatures });
      toast.success('Signature saved');
    },
    onError: (err) => toast.error(extractMessage(err, 'Could not save signature')),
  });
}

export function useSetDefaultVaultSignature(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sigId: string) => svc.setDefaultSignature(id, sigId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.entity(id) });
      void qc.invalidateQueries({ queryKey: vaultKeys.signatures });
    },
    onError: (err) =>
      toast.error(extractMessage(err, 'Could not set default signature')),
  });
}

export function useRemoveVaultSignature(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sigId: string) => svc.removeSignature(id, sigId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultKeys.entity(id) });
      void qc.invalidateQueries({ queryKey: vaultKeys.signatures });
    },
    onError: (err) => toast.error(extractMessage(err, 'Could not remove signature')),
  });
}

/** Pull the server's error message out of an Axios-style error, else fallback.
 *  Surfaces real reasons (e.g. "remove from the Wealth Vault first") instead of
 *  a generic toast. */
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
