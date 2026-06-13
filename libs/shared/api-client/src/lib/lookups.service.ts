import type { HttpClient } from './http';

/**
 * Public lookup groups (states, categories, …) used to populate `lookup`
 * form fields. Backed by the `@Public()` GET /lookups endpoints — no auth
 * required, safe to cache.
 */

export interface LookupValue {
  id: string;
  label: string;
  value: string | null;
  order: number;
  isActive: boolean;
}

export interface LookupGroup {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isPublic?: boolean;
  values: LookupValue[];
}

/** Lightweight list row — no nested values (fetch per-group on select). */
export interface LookupGroupSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isPublic?: boolean;
  valueCount: number;
}
export interface AdminLookupsQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}
export interface AdminLookupsResult {
  items: LookupGroupSummary[];
  total: number;
}

export interface CreateLookupGroupPayload {
  key: string;
  name: string;
  description?: string;
  isPublic?: boolean;
}
export interface UpdateLookupGroupPayload {
  name?: string;
  description?: string;
  isPublic?: boolean;
}
export interface AddLookupValuePayload {
  label: string;
  value: string;
  order?: number;
}
export interface UpdateLookupValuePayload {
  label?: string;
  value?: string;
  order?: number;
  isActive?: boolean;
}

export const createLookupsService = (http: HttpClient) => ({
  /** All public lookup groups with their active values. */
  getAll: () => http.get<LookupGroup[]>('/lookups').then((r) => r.data),
  /** A single group by key (e.g. "in_states"). */
  getByKey: (key: string) =>
    http.get<LookupGroup>(`/lookups/${encodeURIComponent(key)}`).then((r) => r.data),

  // ─── Admin (role: admin) ───────────────────────────────────────────────
  /** ALL groups incl. non-public + inactive values (server-paginated). */
  getAllAdmin: (query?: AdminLookupsQuery) =>
    http
      .get<AdminLookupsResult>('/lookups/admin', { params: query })
      .then((r) => r.data),
  /** One group with its values (fetched when a group is selected). */
  getAdminGroup: (id: string) =>
    http.get<LookupGroup>(`/lookups/admin/${id}`).then((r) => r.data),
  createGroup: (payload: CreateLookupGroupPayload) =>
    http.post<LookupGroup>('/lookups', payload).then((r) => r.data),
  updateGroup: (groupId: string, payload: UpdateLookupGroupPayload) =>
    http.patch<LookupGroup>(`/lookups/${groupId}`, payload).then((r) => r.data),
  deleteGroup: (groupId: string) =>
    http.delete<{ message: string }>(`/lookups/${groupId}`).then((r) => r.data),
  addValue: (groupId: string, payload: AddLookupValuePayload) =>
    http
      .post<LookupValue>(`/lookups/${groupId}/values`, payload)
      .then((r) => r.data),
  updateValue: (valueId: string, payload: UpdateLookupValuePayload) =>
    http
      .patch<LookupValue>(`/lookups/values/${valueId}`, payload)
      .then((r) => r.data),
  deleteValue: (valueId: string) =>
    http
      .delete<{ message: string }>(`/lookups/values/${valueId}`)
      .then((r) => r.data),
});

export type LookupsService = ReturnType<typeof createLookupsService>;
