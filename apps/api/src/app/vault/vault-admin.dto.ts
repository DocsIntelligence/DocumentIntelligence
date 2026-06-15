import { createZodDto } from 'nestjs-zod';
import {
  vaultDocKindConfigSchema,
  vaultEntityKindConfigSchema,
  vaultEntityKindFieldsSchema,
  vaultFieldConfigSchema,
} from '@org/dto';

export class VaultFieldConfigDto extends createZodDto(vaultFieldConfigSchema) {}
export class VaultDocKindConfigDto extends createZodDto(vaultDocKindConfigSchema) {}
export class VaultEntityKindConfigDto extends createZodDto(
  vaultEntityKindConfigSchema,
) {}
export class VaultEntityKindFieldsDto extends createZodDto(
  vaultEntityKindFieldsSchema,
) {}
