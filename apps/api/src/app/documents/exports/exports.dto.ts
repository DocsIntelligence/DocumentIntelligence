import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PageSize } from '@prisma/client';

const CreateExportSchema = z.object({
  // PDF is the only server-rendered format (Puppeteer). Word/.doc is generated
  // client-side from the editor HTML — see apps/app .../editor/export-word.ts.
  format: z.enum(['pdf']).default('pdf'),
  pageSize: z.nativeEnum(PageSize).optional(),
});

export class CreateExportDto extends createZodDto(CreateExportSchema) {}
