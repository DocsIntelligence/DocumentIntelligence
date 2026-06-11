import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ─── Extraction schemas / fields ────────────────────────────────────────────

const FieldType = z.enum([
  'string',
  'number',
  'currency',
  'date',
  'boolean',
  'enum',
  'table',
]);

/** One authored field. `columns` (for `table`) reuses the same field shape. */
const SchemaFieldSchema: z.ZodType<SchemaFieldInput> = z.lazy(() =>
  z.object({
    key: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9_]+$/i, 'key must be alphanumeric/underscore'),
    label: z.string().min(1).max(200),
    type: FieldType.default('string'),
    required: z.boolean().optional(),
    reviewMandatory: z.boolean().optional(),
    /** Soft-disable: inactive fields aren't extracted/reviewed (default true). */
    isActive: z.boolean().optional(),
    // nullish (not just optional): getSchema round-trips DB nulls back here.
    fieldThreshold: z.number().min(0).max(1).nullish(),
    description: z.string().max(2000).nullish(),
    example: z.string().max(500).nullish(),
    format: z.string().max(120).nullish(),
    enumValues: z.array(z.string().min(1)).nullish(),
    columns: z.array(SchemaFieldSchema).nullish(),
  }),
);

export interface SchemaFieldInput {
  key: string;
  label: string;
  type: z.infer<typeof FieldType>;
  required?: boolean;
  reviewMandatory?: boolean;
  isActive?: boolean;
  fieldThreshold?: number | null;
  description?: string | null;
  example?: string | null;
  format?: string | null;
  enumValues?: string[] | null;
  columns?: SchemaFieldInput[] | null;
}

const ExtractionSchemaSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/i, 'key must be alphanumeric/underscore'),
  name: z.string().min(1).max(200),
  documentTypeKey: z.string().max(120).nullish(),
  description: z.string().max(2000).optional(),
  jurisdiction: z.string().max(32).optional(),
  fields: z.array(SchemaFieldSchema).min(1),
});
export class UpsertExtractionSchemaDto extends createZodDto(
  ExtractionSchemaSchema,
) {}

// `PUT /:key` reuses the body without the key (taken from the path).
const UpdateExtractionSchemaSchema = ExtractionSchemaSchema.omit({ key: true });
export class UpdateExtractionSchemaDto extends createZodDto(
  UpdateExtractionSchemaSchema,
) {}

// ─── Field-maps ───────────────────────────────────────────────────────────────

const FieldMapSchema = z.object({
  documentTypeKey: z.string().min(1).max(120),
  mapping: z.record(z.string(), z.string()),
});
export class UpsertFieldMapDto extends createZodDto(FieldMapSchema) {}

// ─── Pipelines / stages ─────────────────────────────────────────────────────

const StageType = z.enum([
  'ingest',
  'classify',
  'filter',
  'extract',
  'validate',
  'review',
  'export',
]);

const StageConfigSchema = z
  .object({
    engineMode: z.enum(['auto', 'native', 'vlm', 'agentic']).optional(),
    schemaKey: z.string().max(120).optional(),
    candidateKeys: z.array(z.string().min(1)).optional(),
    autoAdvance: z
      .object({
        minOverall: z.number().min(0).max(1).optional(),
        minField: z.number().min(0).max(1).optional(),
        requireAllRequired: z.boolean().optional(),
        onFail: z.enum(['review', 'reject']).optional(),
      })
      .optional(),
    targets: z.array(z.string().min(1)).optional(),
    // filter stage
    allowedTypes: z.array(z.string().min(1)).optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    onUnmatched: z.enum(['archive', 'reject', 'review']).optional(),
  })
  .strict();

const StageSchema = z.object({
  type: StageType,
  name: z.string().min(1).max(120),
  config: StageConfigSchema.default({}),
});

const PipelineSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/i, 'key must be alphanumeric/underscore'),
  name: z.string().min(1).max(200),
  stages: z.array(StageSchema).min(1),
});
export class UpsertPipelineDto extends createZodDto(PipelineSchema) {}

const UpdatePipelineSchema = PipelineSchema.omit({ key: true });
export class UpdatePipelineDto extends createZodDto(UpdatePipelineSchema) {}
