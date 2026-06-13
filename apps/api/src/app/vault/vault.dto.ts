import { createZodDto } from 'nestjs-zod';
import { createVaultEntitySchema, updateVaultEntitySchema } from '@org/dto';

export class CreateVaultEntityDto extends createZodDto(createVaultEntitySchema) {}
export class UpdateVaultEntityDto extends createZodDto(updateVaultEntitySchema) {}
