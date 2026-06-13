import type {
  VaultDocKindConfigInput,
  VaultFieldConfigInput,
} from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useVaultAdminService } from '../../documents/services-context';

export const vaultAdminKeys = {
  fields: ['vault-admin', 'fields'] as const,
  docKinds: ['vault-admin', 'doc-kinds'] as const,
};

export function useVaultFields() {
  const svc = useVaultAdminService();
  return useQuery({ queryKey: vaultAdminKeys.fields, queryFn: () => svc.listFields() });
}

export function useVaultDocKinds() {
  const svc = useVaultAdminService();
  return useQuery({ queryKey: vaultAdminKeys.docKinds, queryFn: () => svc.listDocKinds() });
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
