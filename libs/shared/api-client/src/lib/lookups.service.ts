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
  values: LookupValue[];
}

export const createLookupsService = (http: HttpClient) => ({
  /** All public lookup groups with their active values. */
  getAll: () => http.get<LookupGroup[]>('/lookups').then((r) => r.data),
  /** A single group by key (e.g. "in_states"). */
  getByKey: (key: string) =>
    http.get<LookupGroup>(`/lookups/${encodeURIComponent(key)}`).then((r) => r.data),
});

export type LookupsService = ReturnType<typeof createLookupsService>;
