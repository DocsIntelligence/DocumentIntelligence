import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { ShareMode } from '@prisma/client';

const CreateShareSchema = z.object({
  documentId: z.string().cuid(),
  mode: z.nativeEnum(ShareMode).default(ShareMode.view),
  password: z.string().min(4).max(64).optional(),
  expiresAt: z
    .string()
    .datetime()
    .optional(),
});

export class CreateShareDto extends createZodDto(CreateShareSchema) {}

const UnlockShareSchema = z.object({
  password: z.string().min(4).max(64).optional(),
});

export class UnlockShareDto extends createZodDto(UnlockShareSchema) {}
