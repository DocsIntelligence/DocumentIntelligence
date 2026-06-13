import type { HttpClient } from './http';

export type VaultEntityKind = 'person' | 'company' | 'other';

export interface VaultFieldDef {
  key: string;
  label: string;
  sensitive?: boolean;
  revealLast?: number;
}

export interface VaultDocumentSummary {
  id: string;
  kind: string;
  filename: string;
  contentType: string;
  byteSize: number | null;
  createdAt: string;
}

export interface VaultEntitySummary {
  id: string;
  kind: VaultEntityKind;
  label: string;
  documentCount: number;
  fields: Record<string, string>; // masked
  updatedAt: string;
}

export interface VaultEntityDetail {
  id: string;
  kind: VaultEntityKind;
  label: string;
  fields: Record<string, string>; // masked
  schema: VaultFieldDef[];
  documents: VaultDocumentSummary[];
  updatedAt: string;
}

export interface VaultEntityReveal {
  id: string;
  kind: VaultEntityKind;
  label: string;
  fields: Record<string, string>; // unmasked
  schema: VaultFieldDef[];
}

export interface CreateVaultEntityPayload {
  kind: VaultEntityKind;
  label: string;
  fields?: Record<string, string>;
}

export interface UpdateVaultEntityPayload {
  label?: string;
  fields?: Record<string, string>;
}

export const createVaultService = (http: HttpClient) => ({
  list: () =>
    http.get<VaultEntitySummary[]>('/vault/entities').then((r) => r.data),
  get: (id: string) =>
    http.get<VaultEntityDetail>(`/vault/entities/${id}`).then((r) => r.data),
  reveal: (id: string) =>
    http
      .get<VaultEntityReveal>(`/vault/entities/${id}/reveal`)
      .then((r) => r.data),
  autofill: (id: string) =>
    http
      .get<{ id: string; kind: VaultEntityKind; label: string; fields: Record<string, string> }>(
        `/vault/entities/${id}/autofill`,
      )
      .then((r) => r.data),
  create: (payload: CreateVaultEntityPayload) =>
    http.post<VaultEntityDetail>('/vault/entities', payload).then((r) => r.data),
  update: (id: string, payload: UpdateVaultEntityPayload) =>
    http
      .patch<VaultEntityDetail>(`/vault/entities/${id}`, payload)
      .then((r) => r.data),
  remove: (id: string) =>
    http.delete<{ id: string }>(`/vault/entities/${id}`).then((r) => r.data),

  addDocument: (id: string, file: File, kind: string) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<VaultDocumentSummary>(`/vault/entities/${id}/documents`, form, {
        params: { kind },
      })
      .then((r) => r.data);
  },
  documentUrl: (id: string, docId: string) =>
    http
      .get<{ url: string; filename: string; contentType: string }>(
        `/vault/entities/${id}/documents/${docId}/url`,
      )
      .then((r) => r.data),
  removeDocument: (id: string, docId: string) =>
    http
      .delete<{ id: string }>(`/vault/entities/${id}/documents/${docId}`)
      .then((r) => r.data),
});

export type VaultService = ReturnType<typeof createVaultService>;
