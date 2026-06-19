import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { generateDocumentSchema } from '@org/dto';

const ClauseRewriteSchema = z.object({
  documentTypeKey: z.string().min(1),
  promptKey: z.string().min(1).default('clause.rewrite'),
  clause: z.string().min(1).max(4000),
  tone: z
    .enum([
      'formal',
      'plain',
      'tenant-friendly',
      'landlord-friendly',
      'shorter',
    ])
    .default('formal'),
  audience: z.enum(['landlord', 'tenant', 'both']).default('both'),
  jurisdiction: z
    .string()
    .regex(/^IN-[A-Z*]{1,2}$/)
    .default('IN-*'),
});

export class ClauseRewriteDto extends createZodDto(ClauseRewriteSchema) {}

const RuleSuggestSchema = z.object({
  documentTypeKey: z.string().min(1),
  propertyType: z.string().default('apartment'),
  furnished: z.string().default('unfurnished'),
  city: z.string().default('Mumbai'),
  existingRules: z.array(z.string()).default([]),
});

export class RuleSuggestDto extends createZodDto(RuleSuggestSchema) {}

// Draft a whole document as editor-ready HTML from a natural-language brief.
// Validation shared with the client via `@org/dto` (single source of truth).
export class GenerateDocumentDto extends createZodDto(generateDocumentSchema) {}

// Apply a natural-language instruction to an existing document's HTML.
const ReviseDocumentSchema = z.object({
  html: z.string().min(1).max(120000),
  instruction: z.string().min(1).max(2000),
  documentTypeKey: z.string().min(1).optional(),
  /** Optional target language — when set, the whole document is translated into it. */
  language: z.string().min(2).max(40).optional(),
});

export class ReviseDocumentDto extends createZodDto(ReviseDocumentSchema) {}

// ── Bulk statute-PDF import (e.g. the whole BNS) → citation rows ──────────────

// Parse step. Sent as multipart (file + these fields), so every value arrives
// as a string — coerce numbers/booleans and split the comma-separated topics.
const StatuteImportParseSchema = z.object({
  codePrefix: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores (e.g. bns)'),
  actName: z.string().trim().min(1).max(200),
  actShort: z.string().trim().max(40).optional(),
  topics: z
    .string()
    .optional()
    .transform((s) =>
      (s ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  effectiveFrom: z.string().trim().max(40).optional(),
  externalUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  confidence: z.enum(['high', 'moderate', 'low']).default('moderate'),
  password: z.string().max(200).optional(),
  maxSection: z.coerce.number().int().min(1).max(2000).optional(),
});
export class StatuteImportParseDto extends createZodDto(
  StatuteImportParseSchema,
) {}

// JSON-array import. Same metadata as the PDF parse (used as per-record
// fallbacks), plus an optional inline `json` string. Sent as multipart so a
// large array can ride in as an uploaded .json FILE instead of the JSON body
// (which Express caps at ~100 kb).
const StatuteJsonImportSchema = z.object({
  codePrefix: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores (e.g. bns)'),
  actName: z.string().trim().min(1).max(200),
  actShort: z.string().trim().max(40).optional(),
  topics: z
    .string()
    .optional()
    .transform((s) =>
      (s ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  effectiveFrom: z.string().trim().max(40).optional(),
  externalUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  confidence: z.enum(['high', 'moderate', 'low']).default('moderate'),
  /** Inline JSON text — used when no .json file is uploaded. */
  json: z.string().optional(),
});
export class StatuteJsonImportDto extends createZodDto(StatuteJsonImportSchema) {}

// Bulk catalog action over selected citation ids.
const BulkCitationActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000),
  action: z.enum([
    'delete',
    'activate',
    'deactivate',
    'makePublic',
    'makePrivate',
  ]),
});
export class BulkCitationActionDto extends createZodDto(
  BulkCitationActionSchema,
) {}

// Commit step (JSON). Tiny by design — references the staged parse by id and,
// optionally, the subset of section ids the reviewer kept.
const StatuteImportCommitSchema = z.object({
  importId: z.string().min(1),
  includeIds: z.array(z.string()).optional(),
  overwriteExisting: z.boolean().default(false),
});
export class StatuteImportCommitDto extends createZodDto(
  StatuteImportCommitSchema,
) {}
