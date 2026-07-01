import { Module } from '@nestjs/common';
import { IntelligenceAdminController } from './intelligence-admin.controller';
import { IntelligenceAdminService } from './intelligence-admin.service';

/**
 * Admin authoring of pipeline config-as-data (docs/07 P4.2): extraction
 * schemas/fields, field-maps, and pipelines/stages. Depends only on
 * DatabaseService (globally available); the runtime resolver lives in the
 * IntelligenceModule and reads what this module writes.
 */
@Module({
  controllers: [IntelligenceAdminController],
  providers: [IntelligenceAdminService],
  exports: [IntelligenceAdminService],
})
export class IntelligenceAdminModule {}
