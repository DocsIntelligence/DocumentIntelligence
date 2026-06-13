import type {
  CreateVaultEntityPayload,
  ListVaultEntitiesQuery,
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
};

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
    onError: () => toast.error('Could not save entity'),
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
    onError: () => toast.error('Could not save'),
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
    onError: () => toast.error('Could not duplicate'),
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
    onError: () => toast.error('Could not delete'),
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
    onError: () => toast.error('Upload failed'),
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

export function useRemoveVaultDocument(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => svc.removeDocument(id, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entity(id) }),
    onError: () => toast.error('Could not remove document'),
  });
}
