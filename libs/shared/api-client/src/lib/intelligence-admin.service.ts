import type { HttpClient } from './http';

/**
 * Admin authoring of Document-Intelligence config-as-data (docs/07 P4.2):
 * extraction schemas + fields, field-maps, and pipelines + stages. Backed by
 * the admin-guarded `/admin/intelligence/*` API. An edit mints a new immutable
 * version server-side.
 */

export type AdminFieldType =
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'table';

export interface AdminSchemaField {
  key: string;
  label: string;
  type: AdminFieldType;
  required?: boolean;
  reviewMandatory?: boolean;
  fieldThreshold?: number | null;
  description?: string | null;
  example?: string | null;
  format?: string | null;
  enumValues?: string[];
  columns?: AdminSchemaField[];
}

export interface AdminSchemaSummary {
  key: string;
  name: string;
  version: number;
  documentTypeKey: string | null;
  description: string | null;
  jurisdiction: string | null;
  fieldCount: number;
  updatedAt: string;
}

export interface AdminSchemaDetail {
  key: string;
  name: string;
  version: number;
  documentTypeKey: string | null;
  description: string | null;
  jurisdiction: string | null;
  fields: AdminSchemaField[];
}

export interface UpsertSchemaPayload {
  key: string;
  name: string;
  documentTypeKey?: string | null;
  description?: string;
  jurisdiction?: string;
  fields: AdminSchemaField[];
}

export type StageType =
  | 'ingest'
  | 'classify'
  | 'extract'
  | 'validate'
  | 'review'
  | 'export';

export interface StageConfig {
  engineMode?: 'auto' | 'native' | 'vlm' | 'agentic';
  schemaKey?: string;
  candidateKeys?: string[];
  autoAdvance?: {
    minOverall?: number;
    minField?: number;
    requireAllRequired?: boolean;
    onFail?: 'review' | 'reject';
  };
  targets?: string[];
}

export interface PipelineStageInput {
  type: StageType;
  name: string;
  config: StageConfig;
}

export interface AdminPipelineSummary {
  key: string;
  name: string;
  version: number;
  stageCount: number;
  updatedAt: string;
}

export interface AdminPipelineDetail {
  key: string;
  name: string;
  version: number;
  stages: PipelineStageInput[];
}

export interface UpsertPipelinePayload {
  key: string;
  name: string;
  stages: PipelineStageInput[];
}

export interface AdminFieldMap {
  schemaKey: string;
  documentTypeKey: string;
  version: number;
  mapping: Record<string, string>;
}

export const createIntelligenceAdminService = (http: HttpClient) => ({
  // Schemas
  async listSchemas(): Promise<AdminSchemaSummary[]> {
    return (await http.get('/admin/intelligence/schemas')).data;
  },
  async getSchema(key: string): Promise<AdminSchemaDetail> {
    return (await http.get(`/admin/intelligence/schemas/${key}`)).data;
  },
  async createSchema(payload: UpsertSchemaPayload) {
    return (await http.post('/admin/intelligence/schemas', payload)).data;
  },
  async updateSchema(key: string, payload: Omit<UpsertSchemaPayload, 'key'>) {
    return (await http.put(`/admin/intelligence/schemas/${key}`, payload)).data;
  },
  async deleteSchema(key: string) {
    return (await http.delete(`/admin/intelligence/schemas/${key}`)).data;
  },

  // Field-maps
  async getFieldMap(schemaKey: string): Promise<AdminFieldMap> {
    return (await http.get(`/admin/intelligence/field-maps/${schemaKey}`)).data;
  },
  async upsertFieldMap(
    schemaKey: string,
    payload: { documentTypeKey: string; mapping: Record<string, string> },
  ) {
    return (await http.put(`/admin/intelligence/field-maps/${schemaKey}`, payload))
      .data;
  },

  // Pipelines
  async listPipelines(): Promise<AdminPipelineSummary[]> {
    return (await http.get('/admin/intelligence/pipelines')).data;
  },
  async getPipeline(key: string): Promise<AdminPipelineDetail> {
    return (await http.get(`/admin/intelligence/pipelines/${key}`)).data;
  },
  async createPipeline(payload: UpsertPipelinePayload) {
    return (await http.post('/admin/intelligence/pipelines', payload)).data;
  },
  async updatePipeline(key: string, payload: Omit<UpsertPipelinePayload, 'key'>) {
    return (await http.put(`/admin/intelligence/pipelines/${key}`, payload)).data;
  },
  async deletePipeline(key: string) {
    return (await http.delete(`/admin/intelligence/pipelines/${key}`)).data;
  },
});

export type IntelligenceAdminService = ReturnType<
  typeof createIntelligenceAdminService
>;
