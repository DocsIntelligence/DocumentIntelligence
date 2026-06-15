import type {
  VaultDocKindConfigInput,
  VaultEntityKindConfigInput,
  VaultEntityKindFieldsBody,
  VaultFieldConfigInput,
} from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVaultAdminService } from '../../documents/services-context';

export const vaultAdminKeys = {
  entityKinds: ['vault-admin', 'entity-kinds'] as const,
  entityKindFields: (id: string) =>
    ['vault-admin', 'entity-kinds', id, 'fields'] as const,
  fields: ['vault-admin', 'fields'] as const,
  docKinds: ['vault-admin', 'doc-kinds'] as const,
};

// ── Entity kinds ────────────────────────────────────────────────────────

export function useVaultEntityKinds() {
  const svc = useVaultAdminService();
  return useQuery({
    queryKey: vaultAdminKeys.entityKinds,
    queryFn: () => svc.listEntityKinds(),
  });
}

export function useVaultEntityKindFields(entityKindId: string | undefined) {
  const svc = useVaultAdminService();
  return useQuery({
    queryKey: entityKindId
      ? vaultAdminKeys.entityKindFields(entityKindId)
      : ['vault-admin', 'entity-kind-fields', 'none'],
    queryFn: () =>
      entityKindId ? svc.listEntityKindFields(entityKindId) : Promise.resolve([]),
    enabled: !!entityKindId,
  });
}

export function useUpsertVaultEntityKind() {
  const svc = useVaultAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VaultEntityKindConfigInput) => svc.upsertEntityKind(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultAdminKeys.entityKinds });
      toast.success('Entity kind saved');
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : 'Could not save entity kind',
      ),
  });
}

export function useDeleteVaultEntityKind() {
  const svc = useVaultAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.deleteEntityKind(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: vaultAdminKeys.entityKinds }),
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : 'Could not delete entity kind',
      ),
  });
}

export function useSetVaultEntityKindFields(entityKindId: string) {
  const svc = useVaultAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VaultEntityKindFieldsBody) =>
      svc.setEntityKindFields(entityKindId, body),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: vaultAdminKeys.entityKindFields(entityKindId),
      });
      toast.success('Field links saved');
    },
    onError: () => toast.error('Could not save field links'),
  });
}

// ── Fields ──────────────────────────────────────────────────────────────

export function useVaultFields() {
  const svc = useVaultAdminService();
  return useQuery({ queryKey: vaultAdminKeys.fields, queryFn: () => svc.listFields() });
}

export function useUpsertVaultField() {
  const svc = useVaultAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VaultFieldConfigInput) => svc.upsertField(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultAdminKeys.fields });
      toast.success('Field saved');
    },
    onError: () => toast.error('Could not save field'),
  });
}

export function useDeleteVaultField() {
  const svc = useVaultAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.deleteField(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultAdminKeys.fields }),
    onError: () => toast.error('Could not delete field'),
  });
}

// ── Document kinds ──────────────────────────────────────────────────────

export function useVaultDocKinds() {
  const svc = useVaultAdminService();
  return useQuery({ queryKey: vaultAdminKeys.docKinds, queryFn: () => svc.listDocKinds() });
}

export function useUpsertVaultDocKind() {
  const svc = useVaultAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: VaultDocKindConfigInput) => svc.upsertDocKind(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vaultAdminKeys.docKinds });
      toast.success('Document kind saved');
    },
    onError: () => toast.error('Could not save document kind'),
  });
}

export function useDeleteVaultDocKind() {
  const svc = useVaultAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.deleteDocKind(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: vaultAdminKeys.docKinds }),
    onError: () => toast.error('Could not delete document kind'),
  });
}
