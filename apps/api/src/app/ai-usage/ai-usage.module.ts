import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { AiUsageController } from './ai-usage.controller';
import { AiUsagePurgeService } from './ai-usage.purge';
import { AiUsageRecorderService } from './ai-usage.recorder';
import { AiUsageService } from './ai-usage.service';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [AiUsageController],
  providers: [AiUsageRecorderService, AiUsageService, AiUsagePurgeService],
  exports: [AiUsageRecorderService, AiUsageService],
})
export class AiUsageModule {}
