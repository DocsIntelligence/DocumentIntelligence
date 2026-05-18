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
