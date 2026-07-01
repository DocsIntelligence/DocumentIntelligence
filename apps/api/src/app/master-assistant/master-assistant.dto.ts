import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Run a prompt against one master and get a reviewable plan. */
export const masterPlanSchema = z.object({
  masterKey: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  /** Optional scope, e.g. { groupKey, groupName } to target one lookup group. */
  context: z.record(z.string(), z.string()).optional(),
});

/** Commit a staged plan — optionally only the selected record refs, with
 *  optional per-ref edited payloads that override the staged record. */
export const masterCommitSchema = z.object({
  planId: z.string().min(1),
  refs: z.array(z.string()).optional(),
  edits: z.record(z.string(), z.unknown()).optional(),
});

export class MasterPlanDto extends createZodDto(masterPlanSchema) {}
export class MasterCommitDto extends createZodDto(masterCommitSchema) {}
