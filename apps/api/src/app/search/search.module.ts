import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SearchController, SearchAdminController } from './search.controller';
import { SearchConfigService } from './search-config.service';
import { SearchIndexService } from './search-index.service';
import {
  SearchIndexProcessor,
  SEARCH_QUEUE,
  SEARCH_QUEUE_ENABLED,
} from './search.processor';
import { SearchService } from './search.service';
import { SearchTextService } from './search-text.service';

/**
 * Unified search (docs/09). Registered as a GLOBAL module so write paths
 * (DocumentsService, the intelligence pipeline) can inject SearchIndexService to
 * enqueue (re)indexing without importing this module. Indexing runs through
 * BullMQ when REDIS_URL is set, else inline fire-and-forget (mirrors
 * IntelligenceModule). Register exactly once, in AppModule.
 */
@Module({})
export class SearchModule {
  private static readonly logger = new Logger(SearchModule.name);

  static forRootAsync(): DynamicModule {
    const redisUrl = process.env['REDIS_URL'];

    const baseProviders = [
      SearchTextService,
      SearchConfigService,
      SearchIndexService,
      SearchService,
    ];
    const exportsList = [
      SearchIndexService,
      SearchService,
      SearchConfigService,
      SearchTextService,
    ];

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — search indexing runs inline (no queue, no retry).',
      );
      return {
        global: true,
        module: SearchModule,
        imports: [AiModule],
        controllers: [SearchController, SearchAdminController],
        providers: [
          { provide: SEARCH_QUEUE_ENABLED, useValue: false },
          ...baseProviders,
        ],
        exports: exportsList,
      };
    }

    return {
      global: true,
      module: SearchModule,
      imports: [
        AiModule,
        // Self-contained connection so we don't depend on another module's
        // BullModule.forRoot ordering.
        BullModule.registerQueue({
          name: SEARCH_QUEUE,
          connection: { url: redisUrl },
        }),
      ],
      controllers: [SearchController, SearchAdminController],
      providers: [
        { provide: SEARCH_QUEUE_ENABLED, useValue: true },
        ...baseProviders,
        SearchIndexProcessor,
      ],
      exports: exportsList,
    };
  }
}
