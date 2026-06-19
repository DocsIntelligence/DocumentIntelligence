import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PageSize } from '@prisma/client';
import { exportFormatSchema } from '@org/dto';

const CreateExportSchema = z.object({
  // Format enum is the single source of truth in @org/dto (pdf | png). Word/.doc
  // is generated client-side from the editor HTML — see .../editor/export-word.ts.
  format: exportFormatSchema.default('pdf'),
  pageSize: z.nativeEnum(PageSize).optional(),
});

export class CreateExportDto extends createZodDto(CreateExportSchema) {}
