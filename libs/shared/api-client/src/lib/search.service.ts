import type { HttpClient } from './http';

export type SearchKind = 'document' | 'source';
export type SearchSort = 'relevance' | 'recent' | 'title';

export interface SearchHit {
  kind: SearchKind;
  refId: string;
  title: string;
  /** Title with «hl»…«/hl» highlight markers (render via the client helper). */
  titleSnippet: string;
  type: string | null;
  status: string | null;
  /** Body snippet with «hl»…«/hl» highlight markers. */
  snippet: string;
  score: number;
  refUpdatedAt: string | null;
}

export interface SearchFacets {
  document: number;
  source: number;
  asset: number;
}

export interface SearchResponse {
  items: SearchHit[];
  total: number;
  /** Per-kind match counts for the query (ignores the active kind filter). */
  facets: SearchFacets;
  meta: { semantic: boolean; q: string; sort: SearchSort; tookMs: number };
}

export interface SearchQuery {
  q?: string;
  kind?: SearchKind;
  type?: string;
  status?: string;
  sort?: SearchSort;
  page?: number;
  pageSize?: number;
}

export interface SearchConfig {
  id: string;
  ownerOrgId: string | null;
  keywordWeight: number;
  semanticWeight: number;
  semanticEnabled: boolean;
  enabledKinds: SearchKind[];
  fuzzyThreshold: number;
  recencyWeight: number;
  snippetWords: number;
  embeddingModel: string;
  maxResults: number;
}

export type SearchConfigPatch = Partial<
  Omit<SearchConfig, 'id' | 'ownerOrgId'>
>;

export const createSearchService = (http: HttpClient) => ({
  search: (q: SearchQuery) =>
    http.get<SearchResponse>('/search', { params: q }).then((r) => r.data),

  getConfig: (orgId?: string) =>
    http
      .get<SearchConfig>('/admin/search/config', {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),

  updateConfig: (patch: SearchConfigPatch, orgId?: string) =>
    http
      .patch<SearchConfig>('/admin/search/config', patch, {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),

  reindex: () =>
    http
      .post<{ documents: number; sources: number }>('/admin/search/reindex')
      .then((r) => r.data),
});

export type SearchService = ReturnType<typeof createSearchService>;
