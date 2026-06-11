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
  fieldMap: (key: string) => ['admin-intel', 'field-map', key] as const,
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

export function useSchemas(includeInactive = false) {
  const svc = useIntelligenceAdminService();
  return useQuery({
    queryKey: [...adminIntelKeys.schemas, { includeInactive }] as const,
    queryFn: () => svc.listSchemas(includeInactive),
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

/** Permanently delete a schema (all versions). */
export function usePurgeSchema() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => svc.purgeSchema(key),
    onSuccess: () => {
      toast.success('Type deleted');
      qc.invalidateQueries({ queryKey: adminIntelKeys.schemas });
    },
    onError: (err) => toast.error(msg(err, 'Failed to delete type')),
  });
}

/** Enable/disable a schema (soft-disable toggle). */
export function useSetSchemaActive() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; active: boolean }) =>
      vars.active ? svc.activateSchema(vars.key) : svc.deleteSchema(vars.key),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? 'Type enabled' : 'Type disabled');
      qc.invalidateQueries({ queryKey: adminIntelKeys.schemas });
    },
    onError: (err) => toast.error(msg(err, 'Failed to update type')),
  });
}

// ─── Field-maps ───────────────────────────────────────────────────────────────

export function useFieldMap(schemaKey: string | null) {
  const svc = useIntelligenceAdminService();
  return useQuery({
    queryKey: adminIntelKeys.fieldMap(schemaKey ?? ''),
    queryFn: () => svc.getFieldMap(schemaKey as string),
    enabled: Boolean(schemaKey),
    retry: false, // a 404 (no map yet) is an expected, non-retryable state
  });
}

export function useSaveFieldMap() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      schemaKey: string;
      documentTypeKey: string;
      mapping: Record<string, string>;
    }) =>
      svc.upsertFieldMap(vars.schemaKey, {
        documentTypeKey: vars.documentTypeKey,
        mapping: vars.mapping,
      }),
    onSuccess: (_d, vars) => {
      toast.success('Field mapping saved');
      qc.invalidateQueries({ queryKey: adminIntelKeys.fieldMap(vars.schemaKey) });
    },
    onError: (err) => toast.error(msg(err, 'Failed to save mapping')),
  });
}

// ─── Pipelines ──────────────────────────────────────────────────────────────

export function usePipelines(includeInactive = false) {
  const svc = useIntelligenceAdminService();
  return useQuery({
    queryKey: [...adminIntelKeys.pipelines, { includeInactive }] as const,
    queryFn: () => svc.listPipelines(includeInactive),
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

/** Permanently delete a pipeline (all versions; refused if runs exist). */
export function usePurgePipeline() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => svc.purgePipeline(key),
    onSuccess: () => {
      toast.success('Pipeline deleted');
      qc.invalidateQueries({ queryKey: adminIntelKeys.pipelines });
    },
    onError: (err) => toast.error(msg(err, 'Failed to delete pipeline')),
  });
}

/** Enable/disable a pipeline (soft-disable toggle). */
export function useSetPipelineActive() {
  const svc = useIntelligenceAdminService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { key: string; active: boolean }) =>
      vars.active
        ? svc.activatePipeline(vars.key)
        : svc.deletePipeline(vars.key),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? 'Pipeline enabled' : 'Pipeline disabled');
      qc.invalidateQueries({ queryKey: adminIntelKeys.pipelines });
    },
    onError: (err) => toast.error(msg(err, 'Failed to update pipeline')),
  });
}
