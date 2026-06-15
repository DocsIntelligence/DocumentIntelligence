import type { HttpClient } from './http';
import type { SearchResponse, SearchSort } from './search.service';

export interface DocumentGroupSummary {
  id: string;
  name: string;
  kind: string;
  metadata: Record<string, unknown>;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentGroupListResult {
  items: DocumentGroupSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentGroupDetail {
  id: string;
  name: string;
  kind: string;
  metadata: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documents: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    documentType: { key: string; name: string } | null;
  }>;
}

export interface ListGroupsQuery {
  kind?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'name' | 'updated' | 'created';
  dir?: 'asc' | 'desc';
}

export interface CreateGroupPayload {
  name: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  ownerOrgId?: string;
}

export interface PatchGroupPayload {
  name?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface GroupSearchPayload {
  q: string;
  sort?: SearchSort;
  page?: number;
  pageSize?: number;
}

export interface GroupSummary {
  summary: string;
  generatedAt: string | null;
  model: string | null;
}

export interface GenerateGroupSummaryResult {
  summary: string;
  documentSummaries: Array<{
    documentId: string;
    title: string;
    summary: string | null;
  }>;
  model: string;
  generatedAt: string;
  unanalyzedCount: number;
}

export const createDocumentGroupsService = (http: HttpClient) => ({
  list: (q?: ListGroupsQuery) =>
    http
      .get<DocumentGroupListResult>('/groups', { params: q })
      .then((r) => r.data),

  get: (id: string) =>
    http.get<DocumentGroupDetail>(`/groups/${id}`).then((r) => r.data),

  create: (payload: CreateGroupPayload) =>
    http.post<DocumentGroupDetail>('/groups', payload).then((r) => r.data),

  patch: (id: string, payload: PatchGroupPayload) =>
    http
      .patch<DocumentGroupDetail>(`/groups/${id}`, payload)
      .then((r) => r.data),

  remove: (id: string) =>
    http.delete<{ ok: boolean }>(`/groups/${id}`).then((r) => r.data),

  addDocuments: (id: string, documentIds: string[]) =>
    http
      .post<{ ok: boolean; added: number }>(`/groups/${id}/documents`, {
        documentIds,
      })
      .then((r) => r.data),

  removeDocument: (id: string, documentId: string) =>
    http
      .delete<{ ok: boolean }>(`/groups/${id}/documents/${documentId}`)
      .then((r) => r.data),

  search: (id: string, payload: GroupSearchPayload) =>
    http
      .post<SearchResponse>(`/groups/${id}/search`, payload)
      .then((r) => r.data),

  getSummary: (id: string) =>
    http.get<GroupSummary | null>(`/groups/${id}/summary`).then((r) => r.data),

  generateSummary: (id: string) =>
    http
      .post<GenerateGroupSummaryResult>(`/groups/${id}/summary`)
      .then((r) => r.data),
});

export type DocumentGroupsService = ReturnType<
  typeof createDocumentGroupsService
>;
