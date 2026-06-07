import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const ClauseRewriteSchema = z.object({
  documentTypeKey: z.string().min(1),
  promptKey: z.string().min(1).default('clause.rewrite'),
  clause: z.string().min(1).max(4000),
  tone: z.enum(['formal', 'plain', 'tenant-friendly', 'landlord-friendly', 'shorter'])
    .default('formal'),
  audience: z.enum(['landlord', 'tenant', 'both']).default('both'),
  jurisdiction: z.string().regex(/^IN-[A-Z*]{1,2}$/).default('IN-*'),
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
const GenerateDocumentSchema = z.object({
  brief: z.string().min(1).max(6000),
  /** Optional — grounds the draft in a known document type's sections. */
  documentTypeKey: z.string().min(1).optional(),
  title: z.string().max(200).optional(),
  /** Reserved for future localisation of generated headings. */
  language: z.string().min(2).max(8).default('en'),
});

export class GenerateDocumentDto extends createZodDto(GenerateDocumentSchema) {}

// Apply a natural-language instruction to an existing document's HTML.
const ReviseDocumentSchema = z.object({
  html: z.string().min(1).max(120000),
  instruction: z.string().min(1).max(2000),
  documentTypeKey: z.string().min(1).optional(),
});

export class ReviseDocumentDto extends createZodDto(ReviseDocumentSchema) {}
