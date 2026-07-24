import { createZodDto } from 'nestjs-zod';
import { enterpriseLeadSchema } from '@org/dto';

// Validation shared with the client via `@org/dto` (single source of truth).
export class EnterpriseLeadDto extends createZodDto(enterpriseLeadSchema) {}
