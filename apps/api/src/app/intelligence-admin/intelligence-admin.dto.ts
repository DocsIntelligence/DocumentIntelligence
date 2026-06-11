import { createZodDto } from 'nestjs-zod';
import {
  extractionSchemaSchema,
  updateExtractionSchemaSchema,
  fieldMapSchema,
  pipelineSchema,
  updatePipelineSchema,
} from '@org/dto';

// Validation lives in `@org/dto` (single source of truth, shared with the admin
// UI). These thin `createZodDto` wrappers attach the schema to the global
// `ZodValidationPipe`. Re-export the field/input types for service typing.
export type {
  SchemaFieldInput,
  ExtractionSchemaDto,
  UpdateExtractionSchemaDto as IUpdateExtractionSchemaDto,
  FieldMapDto,
  PipelineDto,
  StageInput,
  StageConfig,
} from '@org/dto';

export class UpsertExtractionSchemaDto extends createZodDto(
  extractionSchemaSchema,
) {}

export class UpdateExtractionSchemaDto extends createZodDto(
  updateExtractionSchemaSchema,
) {}

export class UpsertFieldMapDto extends createZodDto(fieldMapSchema) {}

export class UpsertPipelineDto extends createZodDto(pipelineSchema) {}

export class UpdatePipelineDto extends createZodDto(updatePipelineSchema) {}
