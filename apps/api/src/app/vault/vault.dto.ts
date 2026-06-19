import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  createVaultEntitySchema,
  updateVaultEntitySchema,
  recordVaultSignatureSchema,
} from '@org/dto';

export class CreateVaultEntityDto extends createZodDto(createVaultEntitySchema) {}
export class UpdateVaultEntityDto extends createZodDto(updateVaultEntitySchema) {}
export class RecordVaultSignatureDto extends createZodDto(
  recordVaultSignatureSchema,
) {}

/** Server-side pagination/search/sort for the entities list (scales to many). */
const ListVaultEntitiesQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['label', 'kind', 'updated', 'documents']).default('updated'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});
export class ListVaultEntitiesQueryDto extends createZodDto(
  ListVaultEntitiesQuerySchema,
) {}
