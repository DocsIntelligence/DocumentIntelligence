import type {
  CreateGroupPayload,
  GroupSearchPayload,
  ListGroupsQuery,
  PatchGroupPayload,
} from '@org/api-client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDocumentGroupsService } from '../documents/services-context';

export const groupsKeys = {
  all: ['groups'] as const,
  list: () => ['groups', 'list'] as const,
  page: (params: ListGroupsQuery) =>
    ['groups', 'list', 'page', params] as const,
  detail: (id: string) => ['groups', 'detail', id] as const,
  search: (id: string, params: GroupSearchPayload) =>
    ['groups', 'detail', id, 'search', params] as const,
  summary: (id: string) => ['groups', 'detail', id, 'summary'] as const,
};

export function useGroupsPage(params: ListGroupsQuery) {
  const svc = useDocumentGroupsService();
  return useQuery({
    queryKey: groupsKeys.page(params),
    queryFn: () => svc.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useGroup(id: string | undefined) {
  const svc = useDocumentGroupsService();
  return useQuery({
    queryKey: id ? groupsKeys.detail(id) : ['groups', 'detail', 'none'],
    queryFn: () => svc.get(id as string),
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const svc = useDocumentGroupsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => svc.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupsKeys.all });
      toast.success('Group created');
    },
    onError: () => toast.error('Failed to create group'),
  });
}

export function usePatchGroup() {
  const svc = useDocumentGroupsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; payload: PatchGroupPayload }) =>
      svc.patch(vars.id, vars.payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: groupsKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: groupsKeys.list() });
    },
    onError: () => toast.error('Failed to update group'),
  });
}

export function useDeleteGroup() {
  const svc = useDocumentGroupsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupsKeys.all });
      toast.success('Group deleted');
    },
    onError: () => toast.error('Failed to delete group'),
  });
}

export function useAddDocumentsToGroup() {
  const svc = useDocumentGroupsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { groupId: string; documentIds: string[] }) =>
      svc.addDocuments(vars.groupId, vars.documentIds),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: groupsKeys.detail(vars.groupId) });
      toast.success('Documents added to group');
    },
    onError: () => toast.error('Failed to add documents'),
  });
}

export function useRemoveDocumentFromGroup() {
  const svc = useDocumentGroupsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { groupId: string; documentId: string }) =>
      svc.removeDocument(vars.groupId, vars.documentId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: groupsKeys.detail(vars.groupId) });
      toast.success('Document removed from group');
    },
    onError: () => toast.error('Failed to remove document'),
  });
}

export function useGroupSearch(
  id: string | undefined,
  params: GroupSearchPayload,
  enabled = true,
) {
  const svc = useDocumentGroupsService();
  return useQuery({
    queryKey: id
      ? groupsKeys.search(id, params)
      : ['groups', 'detail', 'none', 'search'],
    queryFn: () => svc.search(id as string, params),
    enabled: !!id && !!params.q && enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useGroupSummary(id: string | undefined) {
  const svc = useDocumentGroupsService();
  return useQuery({
    queryKey: id ? groupsKeys.summary(id) : ['groups', 'detail', 'none', 'summary'],
    queryFn: () => svc.getSummary(id as string),
    enabled: !!id,
  });
}

export function useGenerateGroupSummary() {
  const svc = useDocumentGroupsService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.generateSummary(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: groupsKeys.summary(id) });
      qc.invalidateQueries({ queryKey: groupsKeys.detail(id) });
      toast.success('Group summary generated');
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to generate group summary';
      toast.error(msg);
    },
  });
}
