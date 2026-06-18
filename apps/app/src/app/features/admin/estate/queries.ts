import type { UpdateEstateVaultConfig } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEstateService } from '../../documents/services-context';

/** Admin (config-as-data) queries for the Estate & Wealth Vault module. */

export const estateAdminKeys = {
  config: ['estate-admin', 'config'] as const,
  grants: ['estate-admin', 'grants'] as const,
};

export function useEstateAdminConfig() {
  const svc = useEstateService();
  return useQuery({
    queryKey: estateAdminKeys.config,
    queryFn: () => svc.adminGetConfig(),
  });
}

export function useEstateAdminGrants() {
  const svc = useEstateService();
  return useQuery({
    queryKey: estateAdminKeys.grants,
    queryFn: () => svc.adminListGrants(),
  });
}

export function useReleaseGrant() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.adminReleaseGrant(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateAdminKeys.grants });
      toast.success('Access released to the nominee');
    },
    onError: () => toast.error('Could not release access'),
  });
}

export function useUpdateEstateAdminConfig() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateEstateVaultConfig) => svc.adminUpdateConfig(patch),
    onSuccess: (cfg) => {
      qc.setQueryData(estateAdminKeys.config, cfg);
      // The owner-facing capability/asset-type lists derive from this config.
      void qc.invalidateQueries({ queryKey: ['estate', 'capability'] });
      void qc.invalidateQueries({ queryKey: ['estate', 'asset-types'] });
      toast.success('Estate Vault config saved');
    },
    onError: () => toast.error('Could not save config'),
  });
}
