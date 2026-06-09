import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentModule } from '../payment/payment.module';
import { StorageModule } from '../storage/storage.module';
import { IntelligenceController } from './intelligence.controller';
import { IntelligenceProcessor, INTEL_QUEUE } from './intelligence.processor';
import {
  INTEL_QUEUE_ENABLED,
  IntelligenceService,
} from './intelligence.service';
import { AnalysisService } from './analysis.service';
import { ParsingService } from './parsing.service';
import { PipelineService } from './pipeline.service';
import { ReconcilerService } from './reconciler.service';

/**
 * Document Intelligence module (docs/05). A SEPARATE domain — it reuses
 * StorageService, AiService (extended additively with vision/extract), and
 * WalletUsage, but never touches Document/DocumentVersion/editor code.
 *
 *   REDIS_URL set     → BullMQ queue + worker (async, retryable, scalable).
 *   REDIS_URL not set → inline pipeline run (fire-and-forget). Same status
 *                       transitions, so the client polls identically.
 *
 * The reconciler runs in both modes to fail stuck jobs (crash-resilience).
 */
@Module({})
export class IntelligenceModule {
  private static readonly logger = new Logger(IntelligenceModule.name);

  static forRootAsync(): DynamicModule {
    const redisUrl = process.env['REDIS_URL'];
    const common = {
      module: IntelligenceModule,
      controllers: [IntelligenceController],
    };

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — intelligence jobs run inline (no queue, no retry).',
      );
      return {
        ...common,
        imports: [StorageModule, AiModule, PaymentModule, DocumentsModule],
        providers: [
          { provide: INTEL_QUEUE_ENABLED, useValue: false },
          ParsingService,
          PipelineService,
          AnalysisService,
          IntelligenceService,
          ReconcilerService,
        ],
        exports: [IntelligenceService],
      };
    }

    return {
      ...common,
      imports: [
        StorageModule,
        AiModule,
        PaymentModule,
        DocumentsModule,
        BullModule.forRoot({ connection: { url: redisUrl } }),
        BullModule.registerQueue({ name: INTEL_QUEUE }),
      ],
      providers: [
        { provide: INTEL_QUEUE_ENABLED, useValue: true },
        ParsingService,
        PipelineService,
        AnalysisService,
        IntelligenceService,
        IntelligenceProcessor,
        ReconcilerService,
      ],
      exports: [IntelligenceService],
    };
  }
}
