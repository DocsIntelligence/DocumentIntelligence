import type {
  CreateVaultEntityPayload,
  UpdateVaultEntityPayload,
} from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVaultService } from '../documents/services-context';

export const vaultKeys = {
  all: ['vault'] as const,
  list: ['vault', 'entities'] as const,
  entity: (id: string) => ['vault', 'entity', id] as const,
};

export function useVaultEntities() {
  const svc = useVaultService();
  return useQuery({ queryKey: vaultKeys.list, queryFn: () => svc.list() });
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

export function useRemoveVaultDocument(id: string) {
  const svc = useVaultService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => svc.removeDocument(id, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultKeys.entity(id) }),
    onError: () => toast.error('Could not remove document'),
  });
}
