import type { HttpClient } from './http';

export interface ClauseRewritePayload {
  documentTypeKey: string;
  promptKey?: string;
  clause: string;
  tone?: 'formal' | 'plain' | 'tenant-friendly' | 'landlord-friendly' | 'shorter';
  audience?: 'landlord' | 'tenant' | 'both';
  jurisdiction?: string;
}

export interface RuleSuggestPayload {
  documentTypeKey: string;
  propertyType?: string;
  furnished?: string;
  city?: string;
  existingRules?: string[];
}

export interface AiResponse {
  text: string;
  cached: boolean;
  model: string;
}

export interface GenerateDocumentPayload {
  brief: string;
  documentTypeKey?: string;
  title?: string;
  language?: string;
}

export interface GenerateDocumentResponse {
  html: string;
  model: string;
  cached: boolean;
  placeholders: string[];
  disclaimer: string;
}

export interface ReviseDocumentPayload {
  html: string;
  instruction: string;
  documentTypeKey?: string;
  /** When set, translate/rewrite the whole document into this language. */
  language?: string;
}

export interface ReviseDocumentResponse {
  html: string;
  model: string;
  cached: boolean;
  placeholders: string[];
}

export const createLegalAiService = (http: HttpClient) => ({
  clauseRewrite: (payload: ClauseRewritePayload) =>
    http
      .post<AiResponse>('/legal-ai/clause-rewrite', payload)
      .then((r) => r.data),
  ruleSuggest: (payload: RuleSuggestPayload) =>
    http
      .post<AiResponse>('/legal-ai/rule-suggest', payload)
      .then((r) => r.data),
  generate: (payload: GenerateDocumentPayload) =>
    http
      .post<GenerateDocumentResponse>('/legal-ai/generate', payload)
      .then((r) => r.data),
  revise: (payload: ReviseDocumentPayload) =>
    http
      .post<ReviseDocumentResponse>('/legal-ai/revise', payload)
      .then((r) => r.data),
});

export type LegalAiService = ReturnType<typeof createLegalAiService>;
