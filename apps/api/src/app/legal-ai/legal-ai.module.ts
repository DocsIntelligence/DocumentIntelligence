import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DatabaseModule } from '../database/database.module';
import { PaymentModule } from '../payment/payment.module';
import { StorageModule } from '../storage/storage.module';
import { CitationAnalyzerService } from './citation-analyzer.service';
import { CitationApplyService } from './citation-apply.service';
import { CitationAttachmentService } from './citation-attachment.service';
import { CitationCritiqueService } from './citation-critique.service';
import { CitationFillerService } from './citation-filler.service';
import { CitationImportService } from './citation-import.service';
import { CitationSuggesterService } from './citation-suggester.service';
import { CitationSyncService } from './citation-sync.service';
import { ParsingService } from '../intelligence/parsing.service';
import { LegalAiController } from './legal-ai.controller';
import { LegalAiService } from './legal-ai.service';
import { LegalReferenceService } from './legal-reference.service';
import { PublicCitationsController } from './public-citations.controller';
import { BrowserlessFetcher } from './sources/browserless.fetcher';
import { HeadlessFetcherRegistry } from './sources/headless-fetcher.registry';
import { IndiaCodeSourceAdapter } from './sources/indiacode.adapter';
import { LegalSourceRegistry } from './sources/legal-source.registry';
import { PuppeteerFetcher } from './sources/puppeteer.fetcher';

@Module({
  imports: [AiModule, PaymentModule, DatabaseModule, StorageModule],
  controllers: [LegalAiController, PublicCitationsController],
  providers: [
    LegalAiService,
    LegalReferenceService,
    CitationFillerService,
    CitationAnalyzerService,
    CitationApplyService,
    CitationCritiqueService,
    CitationSuggesterService,
    CitationSyncService,
    CitationImportService,
    CitationAttachmentService,
    IndiaCodeSourceAdapter,
    LegalSourceRegistry,
    BrowserlessFetcher,
    PuppeteerFetcher,
    HeadlessFetcherRegistry,
    // ParsingService is stateless (just registers parsers); providing it here
    // lets the IndiaCode adapter parse bare-act PDFs without pulling in the
    // whole IntelligenceModule (which depends on BullMQ / Redis / Storage).
    ParsingService,
  ],
  exports: [
    LegalAiService,
    LegalReferenceService,
    CitationFillerService,
    CitationAnalyzerService,
    CitationApplyService,
    CitationCritiqueService,
  ],
})
export class LegalAiModule {}
