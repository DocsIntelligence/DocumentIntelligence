import { z } from 'zod';

/**
 * Shared (client + server) Zod schemas for authoring Document-Intelligence
 * extraction schemas (docs/07 P4.2). The API wraps these with `createZodDto`
 * for the global `ZodValidationPipe`; the admin UI feeds the SAME schema to
 * `react-hook-form` via `zodResolver`, so a client-valid form is server-valid
 * by construction. Keep this lib client-safe — pure zod, no nestjs imports.
 */

export const fieldTypeSchema = z.enum([
  'string',
  'number',
  'currency',
  'date',
  'boolean',
  'enum',
  'table',
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

const keyRegex = /^[a-z0-9_]+$/i;

/** One authored field. `columns` (for `table`) reuses the same field shape. */
export const schemaFieldSchema: z.ZodType<SchemaFieldInput> = z.lazy(() =>
  z.object({
    key: z
      .string()
      .min(1, 'Field key is required')
      .max(120, 'Field key is too long')
      .regex(keyRegex, 'Use only letters, numbers, and underscores'),
    label: z
      .string()
      .min(1, 'Field label is required')
      .max(200, 'Label is too long'),
    type: fieldTypeSchema.default('string'),
    required: z.boolean().optional(),
    reviewMandatory: z.boolean().optional(),
    /** Soft-disable: inactive fields aren't extracted/reviewed (default true). */
    isActive: z.boolean().optional(),
    // nullish (not just optional): getSchema round-trips DB nulls back here.
    fieldThreshold: z
      .number()
      .min(0, 'Must be between 0 and 1')
      .max(1, 'Must be between 0 and 1')
      .nullish(),
    description: z.string().max(2000, 'Description is too long').nullish(),
    example: z.string().max(500, 'Example is too long').nullish(),
    format: z.string().max(120, 'Format is too long').nullish(),
    enumValues: z.array(z.string().min(1)).nullish(),
    columns: z.array(schemaFieldSchema).nullish(),
  }),
);

export interface SchemaFieldInput {
  key: string;
  label: string;
  type: FieldType;
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

export const extractionSchemaSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .max(120, 'Key is too long')
    .regex(keyRegex, 'Use only letters, numbers, and underscores'),
  name: z
    .string()
    .min(1, 'Display name is required')
    .max(200, 'Name is too long'),
  documentTypeKey: z.string().max(120, 'Type key is too long').nullish(),
  description: z.string().max(2000, 'Description is too long').optional(),
  jurisdiction: z.string().max(32, 'Jurisdiction is too long').optional(),
  fields: z
    .array(schemaFieldSchema)
    .min(1, 'Add at least one field'),
});
export type ExtractionSchemaDto = z.infer<typeof extractionSchemaSchema>;

/** `PUT /:key` reuses the body without the key (taken from the path). */
export const updateExtractionSchemaSchema = extractionSchemaSchema.omit({
  key: true,
});
export type UpdateExtractionSchemaDto = z.infer<
  typeof updateExtractionSchemaSchema
>;
