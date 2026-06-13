import type {
  SearchConfigPatch,
  SearchQuery,
  SearchResponse,
} from '@org/api-client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSearchService } from '../documents/services-context';

export const searchKeys = {
  all: ['search'] as const,
  query: (params: SearchQuery) => ['search', 'query', params] as const,
  config: (orgId?: string) => ['search', 'config', orgId ?? 'system'] as const,
};

/** Hybrid search results. Disabled until there's a query (browse mode is
 *  opt-in via `enabled`). Keeps previous page while fetching the next. */
export function useSearch(params: SearchQuery, enabled = true) {
  const svc = useSearchService();
  return useQuery<SearchResponse>({
    queryKey: searchKeys.query(params),
    queryFn: () => svc.search(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSearchConfig(orgId?: string) {
  const svc = useSearchService();
  return useQuery({
    queryKey: searchKeys.config(orgId),
    queryFn: () => svc.getConfig(orgId),
  });
}

export function useUpdateSearchConfig(orgId?: string) {
  const svc = useSearchService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SearchConfigPatch) => svc.updateConfig(patch, orgId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: searchKeys.config(orgId) });
      toast.success('Search settings saved');
    },
    onError: () => toast.error('Could not save search settings'),
  });
}

export function useReindex() {
  const svc = useSearchService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => svc.reindex(),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: searchKeys.all });
      toast.success(`Reindexed ${r.documents} documents + ${r.sources} sources`);
    },
    onError: () => toast.error('Reindex failed'),
  });
}
