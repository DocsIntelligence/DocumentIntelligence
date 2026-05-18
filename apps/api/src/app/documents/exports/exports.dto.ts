import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PageSize } from '@prisma/client';

const CreateExportSchema = z.object({
  format: z.enum(['pdf']).default('pdf'),
  pageSize: z.nativeEnum(PageSize).optional(),
});

export class CreateExportDto extends createZodDto(CreateExportSchema) {}
