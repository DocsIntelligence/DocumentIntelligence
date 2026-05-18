import type { HttpClient } from './http';

/**
 * Document/template DTOs as returned by apps/api. Kept loose (string for
 * dates, unknown for `data`) so the client lib doesn't drag the full
 * Prisma type tree across the wire.
 */

export type DocumentStatus =
  | 'draft'
  | 'in_review'
  | 'ready'
  | 'signed'
  | 'archived';

export type PageSize =
  | 'a4'
  | 'legal'
  | 'foolscap'
  | 'stamp_paper_in_10'
  | 'stamp_paper_in_20'
  | 'stamp_paper_in_50'
  | 'stamp_paper_in_100'
  | 'stamp_paper_in_500';

export interface DocumentTypeSummary {
  id: string;
  key: string;
  name: string;
  category: string;
  description: string | null;
  defaultPageSize: PageSize;
  jurisdictions: string[];
  iconKey: string | null;
  sortOrder: number;
  templates: DocumentTemplateSummary[];
}

export interface DocumentTemplateSummary {
  id: string;
  key: string;
  name: string;
  componentKey: string;
  language: string;
  jurisdictions: string[];
  isPremium: boolean;
}

export interface DocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  pageSize: PageSize;
  language: string;
  jurisdiction: string | null;
  documentTypeId: string;
  templateId: string;
  updatedAt: string;
  createdAt: string;
  documentType?: { key: string; name: string };
  template?: { key: string; name: string };
}

export interface DocumentDetail extends DocumentSummary {
  data: Record<string, unknown>;
  lockedAt: string | null;
  ownerUserId: string | null;
  ownerOrgId: string | null;
  ownerType: 'user' | 'organisation';
}

export interface CreateDocumentPayload {
  title: string;
  documentTypeKey: string;
  templateKey: string;
  pageSize?: PageSize;
  language?: string;
  jurisdiction?: string;
  data?: Record<string, unknown>;
  ownerOrgId?: string;
}

export interface PatchDocumentPayload {
  title?: string;
  data?: Record<string, unknown>;
  pageSize?: PageSize;
  language?: string;
  jurisdiction?: string;
  templateKey?: string;
  status?: DocumentStatus;
}

export interface ListDocumentsQuery {
  documentTypeKey?: string;
  status?: DocumentStatus;
  orgId?: string;
  limit?: number;
  cursor?: string;
}

export interface DocumentExportStatus {
  id: string;
  status: 'pending' | 'ready' | 'failed';
  pageSize: PageSize;
  format: string;
  s3Key: string | null;
  byteSize: number | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentExportDownload =
  | {
      ready: true;
      url: string;
      byteSize: number | null;
      pageSize: PageSize;
    }
  | {
      ready: false;
      status: 'pending' | 'ready' | 'failed';
      error: string | null;
    };

export interface CreateExportPayload {
  format?: 'pdf';
  pageSize?: PageSize;
}

export const createDocumentsService = (http: HttpClient) => ({
  catalog: () =>
    http.get<DocumentTypeSummary[]>('/documents/catalog').then((r) => r.data),
  list: (q?: ListDocumentsQuery) =>
    http
      .get<DocumentSummary[]>('/documents', { params: q })
      .then((r) => r.data),
  get: (id: string) =>
    http.get<DocumentDetail>(`/documents/${id}`).then((r) => r.data),
  create: (payload: CreateDocumentPayload) =>
    http.post<DocumentDetail>('/documents', payload).then((r) => r.data),
  patch: (id: string, payload: PatchDocumentPayload) =>
    http.patch<DocumentDetail>(`/documents/${id}`, payload).then((r) => r.data),
  snapshot: (id: string, label?: string) =>
    http
      .post<{ id: string }>(`/documents/${id}/snapshot`, { label })
      .then((r) => r.data),
  remove: (id: string) =>
    http.delete<{ id: string }>(`/documents/${id}`).then((r) => r.data),
  enqueueExport: (id: string, payload: CreateExportPayload = {}) =>
    http
      .post<DocumentExportStatus>(`/documents/${id}/exports`, payload)
      .then((r) => r.data),
  getExport: (id: string, exportId: string) =>
    http
      .get<DocumentExportStatus>(`/documents/${id}/exports/${exportId}`)
      .then((r) => r.data),
  getExportDownload: (id: string, exportId: string) =>
    http
      .get<DocumentExportDownload>(
        `/documents/${id}/exports/${exportId}/download`,
      )
      .then((r) => r.data),
});

export type DocumentsService = ReturnType<typeof createDocumentsService>;
