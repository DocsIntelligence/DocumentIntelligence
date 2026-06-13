import { createZodDto } from 'nestjs-zod';
import { vaultFieldConfigSchema, vaultDocKindConfigSchema } from '@org/dto';

export class VaultFieldConfigDto extends createZodDto(vaultFieldConfigSchema) {}
export class VaultDocKindConfigDto extends createZodDto(vaultDocKindConfigSchema) {}
