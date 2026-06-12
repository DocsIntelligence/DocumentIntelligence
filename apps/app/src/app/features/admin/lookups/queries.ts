import type {
  AddLookupValuePayload,
  CreateLookupGroupPayload,
  UpdateLookupGroupPayload,
  UpdateLookupValuePayload,
} from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { useLookupsService } from '../../documents/services-context';

export const lookupAdminKeys = {
  all: ['admin-lookups'] as const,
};

function msg(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    const m = data?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}

export function useAdminLookups() {
  const svc = useLookupsService();
  return useQuery({
    queryKey: lookupAdminKeys.all,
    queryFn: () => svc.getAllAdmin(),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: lookupAdminKeys.all });
    // The builder reads the public list — refresh it too.
    qc.invalidateQueries({ queryKey: ['lookups'] });
  };
}

export function useCreateGroup() {
  const svc = useLookupsService();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: CreateLookupGroupPayload) => svc.createGroup(payload),
    onSuccess: () => {
      toast.success('Lookup group created');
      invalidate();
    },
    onError: (err) => toast.error(msg(err, 'Failed to create group')),
  });
}

export function useUpdateGroup() {
  const svc = useLookupsService();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: string; payload: UpdateLookupGroupPayload }) =>
      svc.updateGroup(vars.id, vars.payload),
    onSuccess: () => {
      toast.success('Group updated');
      invalidate();
    },
    onError: (err) => toast.error(msg(err, 'Failed to update group')),
  });
}

export function useDuplicateGroup() {
  const svc = useLookupsService();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (vars: {
      key: string;
      name: string;
      description?: string | null;
      isPublic?: boolean;
      values: { label: string; value: string | null; order: number }[];
    }) => {
      const group = await svc.createGroup({
        key: vars.key,
        name: vars.name,
        description: vars.description ?? undefined,
        isPublic: vars.isPublic ?? true,
      });
      // Copy values in order (sequential to preserve order + avoid races).
      for (const v of [...vars.values].sort((a, b) => a.order - b.order)) {
        await svc.addValue(group.id, {
          label: v.label,
          value: v.value ?? v.label,
          order: v.order,
        });
      }
      return group;
    },
    onSuccess: () => {
      toast.success('Lookup group duplicated');
      invalidate();
    },
    onError: (err) => toast.error(msg(err, 'Failed to duplicate group')),
  });
}

export function useDeleteGroup() {
  const svc = useLookupsService();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => svc.deleteGroup(id),
    onSuccess: () => {
      toast.success('Group deleted');
      invalidate();
    },
    onError: (err) => toast.error(msg(err, 'Failed to delete group')),
  });
}

export function useAddValue() {
  const svc = useLookupsService();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { groupId: string; payload: AddLookupValuePayload }) =>
      svc.addValue(vars.groupId, vars.payload),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(msg(err, 'Failed to add value')),
  });
}

export function useUpdateValue() {
  const svc = useLookupsService();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { id: string; payload: UpdateLookupValuePayload }) =>
      svc.updateValue(vars.id, vars.payload),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(msg(err, 'Failed to update value')),
  });
}

export function useDeleteValue() {
  const svc = useLookupsService();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => svc.deleteValue(id),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(msg(err, 'Failed to delete value')),
  });
}
