import type {
  UpsertPipelinePayload,
  UpsertSchemaPayload,
} from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useIntelligenceAdminService } from '../../documents/services-context';

export const adminIntelKeys = {
  schemas: ['admin-intel', 'schemas'] as const,
  schema: (key: string) => ['admin-intel', 'schema', key] as const,
  pipelines: ['admin-intel', 'pipelines'] as const,
  pipeline: (key: string) => ['admin-intel', 'pipeline', key] as const,
};

function msg(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string | string[] } | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export function useSchemas() {
  const svc = useIntelligenceAdminService();
  return useQuery({
    queryKey: adminIntelKeys.schemas,
    queryFn: () => svc.listSchemas(),
  });
}

export function useSchema(key: string | null) {
  const svc = useIntelligenceAdminService();
  return useQuery({
    queryKey: adminIntelKeys.schema(key ?? ''),
    queryFn: () => svc.getSchema(key as string),
    enabled: Boolean(key),
  });
}

export function useSaveSchema() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { exists: boolean; payload: UpsertSchemaPayload }) =>
      vars.exists
        ? svc.updateSchema(vars.payload.key, vars.payload)
        : svc.createSchema(vars.payload),
    onSuccess: (_d, vars) => {
      toast.success(`Schema "${vars.payload.key}" saved`);
      qc.invalidateQueries({ queryKey: adminIntelKeys.schemas });
      qc.invalidateQueries({ queryKey: adminIntelKeys.schema(vars.payload.key) });
    },
    onError: (err) => toast.error(msg(err, 'Failed to save schema')),
  });
}

export function useDeleteSchema() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => svc.deleteSchema(key),
    onSuccess: () => {
      toast.success('Schema deactivated');
      qc.invalidateQueries({ queryKey: adminIntelKeys.schemas });
    },
    onError: (err) => toast.error(msg(err, 'Failed to delete schema')),
  });
}

// ─── Pipelines ──────────────────────────────────────────────────────────────

export function usePipelines() {
  const svc = useIntelligenceAdminService();
  return useQuery({
    queryKey: adminIntelKeys.pipelines,
    queryFn: () => svc.listPipelines(),
  });
}

export function usePipeline(key: string | null) {
  const svc = useIntelligenceAdminService();
  return useQuery({
    queryKey: adminIntelKeys.pipeline(key ?? ''),
    queryFn: () => svc.getPipeline(key as string),
    enabled: Boolean(key),
  });
}

export function useSavePipeline() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { exists: boolean; payload: UpsertPipelinePayload }) =>
      vars.exists
        ? svc.updatePipeline(vars.payload.key, vars.payload)
        : svc.createPipeline(vars.payload),
    onSuccess: (_d, vars) => {
      toast.success(`Pipeline "${vars.payload.key}" saved`);
      qc.invalidateQueries({ queryKey: adminIntelKeys.pipelines });
      qc.invalidateQueries({ queryKey: adminIntelKeys.pipeline(vars.payload.key) });
    },
    onError: (err) => toast.error(msg(err, 'Failed to save pipeline')),
  });
}

export function useDeletePipeline() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => svc.deletePipeline(key),
    onSuccess: () => {
      toast.success('Pipeline deactivated');
      qc.invalidateQueries({ queryKey: adminIntelKeys.pipelines });
    },
    onError: (err) => toast.error(msg(err, 'Failed to delete pipeline')),
  });
}
