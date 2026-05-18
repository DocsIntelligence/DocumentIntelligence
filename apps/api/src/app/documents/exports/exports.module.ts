import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { ExportsService, PDF_QUEUE_ENABLED } from './exports.service';
import {
  PDF_RENDER_QUEUE,
  PdfRenderProcessor,
} from './pdf-render.processor';

/**
 * Exports submodule. Boots BullMQ for PDF renders when REDIS_URL is set,
 * otherwise falls back to a "queue disabled" mode where enqueue calls
 * record a failed DocumentExport with a helpful error message.
 *
 * Pattern mirrors MailModule.forRootAsync — keeps the API runnable in
 * environments without Redis (local dev without the docker compose).
 */
@Module({})
export class ExportsModule {
  private static readonly logger = new Logger(ExportsModule.name);

  static forRootAsync(): DynamicModule {
    const redisUrl = process.env['REDIS_URL'];

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — PDF export queue disabled. Exports will be rejected.',
      );
      return {
        module: ExportsModule,
        imports: [StorageModule],
        providers: [
          { provide: PDF_QUEUE_ENABLED, useValue: false },
          ExportsService,
        ],
        exports: [ExportsService],
      };
    }

    return {
      module: ExportsModule,
      imports: [
        StorageModule,
        BullModule.forRoot({ connection: { url: redisUrl } }),
        BullModule.registerQueue({ name: PDF_RENDER_QUEUE }),
      ],
      providers: [
        { provide: PDF_QUEUE_ENABLED, useValue: true },
        ExportsService,
        PdfRenderProcessor,
      ],
      exports: [ExportsService],
    };
  }
}
