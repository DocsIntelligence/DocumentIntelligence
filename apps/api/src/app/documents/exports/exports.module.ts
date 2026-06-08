import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module';
import { ExportsService, PDF_QUEUE_ENABLED } from './exports.service';
import { PDF_RENDER_QUEUE, PdfRenderProcessor } from './pdf-render.processor';
import { PdfRendererService } from './pdf-renderer.service';

/**
 * Exports submodule.
 *
 *   REDIS_URL set     → BullMQ queue + worker. Enqueue is async, worker
 *                       polls jobs, scales horizontally.
 *   REDIS_URL not set → Inline renderer. ExportsService kicks off the
 *                       same PdfRendererService directly (fire-and-forget),
 *                       so dev works without Redis. No retry, no scaling.
 *
 * Both branches share PdfRendererService, so the actual render-and-upload
 * logic exists in exactly one place.
 */
@Module({})
export class ExportsModule {
  private static readonly logger = new Logger(ExportsModule.name);

  static forRootAsync(): DynamicModule {
    const redisUrl = process.env['REDIS_URL'];

    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL not set — PDF exports will render inline (no queue, no retry).',
      );
      return {
        module: ExportsModule,
        imports: [StorageModule],
        providers: [
          { provide: PDF_QUEUE_ENABLED, useValue: false },
          PdfRendererService,
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
        PdfRendererService,
        ExportsService,
        PdfRenderProcessor,
      ],
      exports: [ExportsService],
    };
  }
}
