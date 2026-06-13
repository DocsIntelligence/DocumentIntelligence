import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchConfigSchema } from '@org/dto';

const SearchQuerySchema = z.object({
  q: z.string().trim().max(300).optional(),
  kind: z.enum(['document', 'source']).optional(),
  type: z.string().max(120).optional(),
  status: z.string().max(60).optional(),
  sort: z.enum(['relevance', 'recent', 'title']).default('relevance'),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export class SearchQueryDto extends createZodDto(SearchQuerySchema) {}

/** Admin: update org/system search config. Reuses the shared @org/dto schema. */
export class UpdateSearchConfigDto extends createZodDto(searchConfigSchema) {}
