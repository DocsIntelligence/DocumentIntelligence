import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DocumentGroupsController } from './document-groups.controller';
import { DocumentGroupsService } from './document-groups.service';
import { GroupIntelligenceService } from './group-intelligence.service';

@Module({
  imports: [AiModule],
  controllers: [DocumentGroupsController],
  providers: [DocumentGroupsService, GroupIntelligenceService],
  exports: [DocumentGroupsService, GroupIntelligenceService],
})
export class DocumentGroupsModule {}
