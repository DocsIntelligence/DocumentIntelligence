import { z } from 'zod';

const keyRegex = /^[a-z0-9_]+$/i;

export const stageTypeSchema = z.enum([
  'ingest',
  'classify',
  'filter',
  'extract',
  'validate',
  'review',
  'export',
]);
export type StageType = z.infer<typeof stageTypeSchema>;

export const stageConfigSchema = z
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
export type StageConfig = z.infer<typeof stageConfigSchema>;

export const stageSchema = z.object({
  type: stageTypeSchema,
  name: z.string().min(1, 'Stage name is required').max(120, 'Name is too long'),
  config: stageConfigSchema.default({}),
});
export type StageInput = z.infer<typeof stageSchema>;

export const pipelineSchema = z.object({
  key: z
    .string()
    .min(1, 'Key is required')
    .max(120, 'Key is too long')
    .regex(keyRegex, 'Use only letters, numbers, and underscores'),
  name: z
    .string()
    .min(1, 'Display name is required')
    .max(200, 'Name is too long'),
  stages: z.array(stageSchema).min(1, 'Add at least one stage'),
});
export type PipelineDto = z.infer<typeof pipelineSchema>;

export const updatePipelineSchema = pipelineSchema.omit({ key: true });
export type UpdatePipelineDto = z.infer<typeof updatePipelineSchema>;
