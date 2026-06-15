import type { HttpClient } from './http';

/**
 * Entity kind keys are stored as free-form strings now — the DB-driven
 * VaultEntityKindConfig table seeds the 7 defaults below and admins can
 * add more. The literal union below is kept for documentation only; use
 * `KNOWN_VAULT_KINDS` for the static fallback list.
 */
export type VaultEntityKind = string;

export const KNOWN_VAULT_KINDS = [
  'person',
  'company',
  'lawyer',
  'court',
  'case',
  'property',
  'other',
] as const;

export type VaultBadgeVariant =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'warning'
  | 'success';

export type VaultFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'tel'
  | 'email'
  | 'select'
  | 'lookup';

export interface VaultFieldDef {
  key: string;
  label: string;
  type?: VaultFieldType;
  group?: string;
  options?: string[];
  lookupKey?: string;
  sensitive?: boolean;
  revealLast?: number;
  placeholder?: string;
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
  isActive: boolean;
  documentCount: number;
  updatedAt: string;
}

export interface VaultEntityDetail {
  id: string;
  kind: VaultEntityKind;
  label: string;
  isActive: boolean;
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

export interface VaultEntityListResult {
  items: VaultEntitySummary[];
  total: number;
}

export interface ListVaultEntitiesQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'label' | 'kind' | 'updated' | 'documents';
  dir?: 'asc' | 'desc';
}

export interface CreateVaultEntityPayload {
  kind: VaultEntityKind;
  label: string;
  fields?: Record<string, string>;
}

export interface UpdateVaultEntityPayload {
  label?: string;
  fields?: Record<string, string>;
  isActive?: boolean;
}

export const createVaultService = (http: HttpClient) => ({
  /** Active entity kinds — drives the create-entity picker. */
  entityKinds: () =>
    http
      .get<VaultEntityKindConfig[]>('/vault/entity-kinds')
      .then((r) => r.data),
  list: (query?: ListVaultEntitiesQuery) =>
    http
      .get<VaultEntityListResult>('/vault/entities', { params: query })
      .then((r) => r.data),
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
  duplicate: (id: string) =>
    http
      .post<VaultEntityDetail>(`/vault/entities/${id}/duplicate`)
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

  /** Vision-scan an attached document → suggested canonical field values. */
  scanDocument: (id: string, docId: string) =>
    http
      .post<{ documentId: string; kind: string; suggestions: Record<string, string> }>(
        `/vault/entities/${id}/documents/${docId}/scan`,
      )
      .then((r) => r.data),
});

export interface VaultFieldConfig {
  id: string;
  ownerOrgId: string | null;
  key: string;
  label: string;
  type: VaultFieldType;
  group: string | null;
  options: string[];
  lookupKey: string | null;
  sensitive: boolean;
  revealLast: number | null;
  placeholder: string | null;
  isActive: boolean;
}

export interface VaultDocKindConfig {
  id: string;
  ownerOrgId: string | null;
  kind: string;
  label: string;
  fills: string[];
  scannable: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface VaultEntityKindConfig {
  id: string;
  ownerOrgId: string | null;
  key: string;
  label: string;
  badgeVariant: VaultBadgeVariant;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
}

/** A row in the kind ↔ field join table, hydrated with the joined field. */
export interface VaultEntityKindFieldLink {
  id: string;
  entityKindId: string;
  fieldId: string;
  sortOrder: number;
  groupOverride: string | null;
  isActive: boolean;
  field: VaultFieldConfig;
}

export type VaultFieldConfigInput = Omit<VaultFieldConfig, 'id' | 'ownerOrgId'> & {
  id?: string;
};
export type VaultDocKindConfigInput = Omit<VaultDocKindConfig, 'id' | 'ownerOrgId'> & {
  id?: string;
};
export type VaultEntityKindConfigInput = Omit<
  VaultEntityKindConfig,
  'id' | 'ownerOrgId' | 'isSystem'
> & {
  id?: string;
};

/** Body for PUT /admin/vault/entity-kinds/:id/fields — replaces the link set. */
export interface VaultEntityKindFieldsBody {
  links: Array<{
    fieldId: string;
    groupOverride?: string | null;
    isActive?: boolean;
  }>;
}

/** Admin config for the vault catalog (system defaults; pass orgId for overrides). */
export const createVaultAdminService = (http: HttpClient) => ({
  // ── Entity kinds ─────────────────────────────────────────────────────
  listEntityKinds: (orgId?: string) =>
    http
      .get<VaultEntityKindConfig[]>('/admin/vault/entity-kinds', {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),
  upsertEntityKind: (body: VaultEntityKindConfigInput, orgId?: string) =>
    http
      .post<VaultEntityKindConfig>('/admin/vault/entity-kinds', body, {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),
  deleteEntityKind: (id: string) =>
    http
      .delete<{ id: string }>(`/admin/vault/entity-kinds/${id}`)
      .then((r) => r.data),
  listEntityKindFields: (id: string) =>
    http
      .get<VaultEntityKindFieldLink[]>(`/admin/vault/entity-kinds/${id}/fields`)
      .then((r) => r.data),
  setEntityKindFields: (id: string, body: VaultEntityKindFieldsBody) =>
    http
      .put<VaultEntityKindFieldLink[]>(
        `/admin/vault/entity-kinds/${id}/fields`,
        body,
      )
      .then((r) => r.data),

  // ── Fields ───────────────────────────────────────────────────────────
  listFields: (orgId?: string) =>
    http
      .get<VaultFieldConfig[]>('/admin/vault/fields', {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),
  upsertField: (body: VaultFieldConfigInput, orgId?: string) =>
    http
      .post<VaultFieldConfig>('/admin/vault/fields', body, {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),
  deleteField: (id: string) =>
    http.delete<{ id: string }>(`/admin/vault/fields/${id}`).then((r) => r.data),

  // ── Document kinds ───────────────────────────────────────────────────
  listDocKinds: (orgId?: string) =>
    http
      .get<VaultDocKindConfig[]>('/admin/vault/doc-kinds', {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),
  upsertDocKind: (body: VaultDocKindConfigInput, orgId?: string) =>
    http
      .post<VaultDocKindConfig>('/admin/vault/doc-kinds', body, {
        params: orgId ? { orgId } : undefined,
      })
      .then((r) => r.data),
  deleteDocKind: (id: string) =>
    http
      .delete<{ id: string }>(`/admin/vault/doc-kinds/${id}`)
      .then((r) => r.data),
});

export type VaultAdminService = ReturnType<typeof createVaultAdminService>;

/** Document kinds that can be scanned to autofill fields (label + which it fills). */
export const VAULT_DOC_KINDS: { kind: string; label: string; scannable: boolean }[] = [
  { kind: 'aadhaar', label: 'Aadhaar card', scannable: true },
  { kind: 'pan', label: 'PAN card', scannable: true },
  { kind: 'passport', label: 'Passport', scannable: true },
  { kind: 'voter_id', label: 'Voter ID', scannable: true },
  { kind: 'driving_licence', label: 'Driving licence', scannable: true },
  { kind: 'gst', label: 'GST certificate', scannable: true },
  { kind: 'incorporation', label: 'Incorporation certificate', scannable: true },
  { kind: 'bank', label: 'Bank passbook / cheque', scannable: true },
  { kind: 'other', label: 'Other', scannable: false },
];

export type VaultService = ReturnType<typeof createVaultService>;
