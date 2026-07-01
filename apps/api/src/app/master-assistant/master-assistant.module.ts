import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { IntelligenceAdminModule } from '../intelligence-admin/intelligence-admin.module';
import { LegalAiModule } from '../legal-ai/legal-ai.module';
import { LookupModule } from '../lookup/lookup.module';
import { DocumentTypeMasterAdapter } from './adapters/document-type.adapter';
import { LegalReferenceMasterAdapter } from './adapters/legal-reference.adapter';
import { LookupMasterAdapter } from './adapters/lookup.adapter';
import { MasterAdapterRegistry } from './master-adapter.registry';
import { MasterAssistantController } from './master-assistant.controller';
import { MasterAssistantService } from './master-assistant.service';

/**
 * AI-assisted master setup. Generic plan→commit service over a registry of
 * master adapters; each adapter delegates writes to that master's own module
 * (LookupModule, IntelligenceAdminModule, LegalAiModule), and AI structured
 * extraction comes from AiModule.
 */
@Module({
  imports: [AiModule, LookupModule, IntelligenceAdminModule, LegalAiModule],
  controllers: [MasterAssistantController],
  providers: [
    MasterAssistantService,
    MasterAdapterRegistry,
    LookupMasterAdapter,
    DocumentTypeMasterAdapter,
    LegalReferenceMasterAdapter,
  ],
})
export class MasterAssistantModule {}
