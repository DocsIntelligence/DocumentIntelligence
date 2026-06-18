import { createZodDto } from 'nestjs-zod';
import {
  bulkCreateAssetsSchema,
  createAssetSchema,
  createEstateProfileSchema,
  updateEstateProfileSchema,
  createNomineeSchema,
  listAssetsQuerySchema,
  recordValuationSchema,
  setNominationsSchema,
  shareEstateProfileSchema,
  updateAssetSchema,
  updateEstateVaultConfigSchema,
  updateNomineeSchema,
  updateReleasePlanSchema,
  vaultSearchQuerySchema,
} from '@org/dto';

export class CreateAssetDto extends createZodDto(createAssetSchema) {}
export class BulkCreateAssetsDto extends createZodDto(bulkCreateAssetsSchema) {}
export class UpdateAssetDto extends createZodDto(updateAssetSchema) {}
export class RecordValuationDto extends createZodDto(recordValuationSchema) {}
export class ListAssetsQueryDto extends createZodDto(listAssetsQuerySchema) {}
export class VaultSearchQueryDto extends createZodDto(vaultSearchQuerySchema) {}
export class UpdateEstateVaultConfigDto extends createZodDto(
  updateEstateVaultConfigSchema,
) {}
export class CreateNomineeDto extends createZodDto(createNomineeSchema) {}
export class UpdateNomineeDto extends createZodDto(updateNomineeSchema) {}
export class SetNominationsDto extends createZodDto(setNominationsSchema) {}
export class UpdateReleasePlanDto extends createZodDto(updateReleasePlanSchema) {}
export class CreateEstateProfileDto extends createZodDto(
  createEstateProfileSchema,
) {}
export class UpdateEstateProfileDto extends createZodDto(
  updateEstateProfileSchema,
) {}
export class ShareEstateProfileDto extends createZodDto(
  shareEstateProfileSchema,
) {}
