import type { HttpClient } from './http';

export type ShareMode = 'view' | 'comment' | 'edit';

export interface CreateSharePayload {
  documentId: string;
  mode?: ShareMode;
  password?: string;
  /** ISO datetime; omit for no expiry. */
  expiresAt?: string;
}

export interface ShareRecord {
  id: string;
  token: string;
  mode: ShareMode;
  documentId: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface SharedComment {
  id: string;
  authorName: string;
  body: string;
  resolved: boolean;
  createdAt: string;
}

export interface SharedDocument {
  mode: ShareMode;
  comments: SharedComment[];
  document: {
    id: string;
    title: string;
    status: string;
    pageSize: string;
    language: string;
    jurisdiction: string | null;
    data: Record<string, unknown>;
    documentType: { key: string; name: string };
    template: { key: string; name: string; componentKey: string };
  };
}

export type ResolveShareResult = { requiresPassword: true } | SharedDocument;

export function isSharedDocument(r: ResolveShareResult): r is SharedDocument {
  return (r as SharedDocument).document !== undefined;
}

export const createSharesService = (http: HttpClient) => ({
  create: (payload: CreateSharePayload) =>
    http.post<ShareRecord>('/shares', payload).then((r) => r.data),
  resolve: (token: string, password?: string) =>
    http
      .post<ResolveShareResult>(`/shares/public/${token}`, { password })
      .then((r) => r.data),
  addComment: (
    token: string,
    payload: { authorName: string; body: string; password?: string },
  ) =>
    http
      .post<SharedComment>(`/shares/public/${token}/comments`, payload)
      .then((r) => r.data),
});

export type SharesService = ReturnType<typeof createSharesService>;
