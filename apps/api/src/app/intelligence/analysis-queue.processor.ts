import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ANALYSIS_QUEUE,
  AnalysisQueueService,
  type AnalysisQueuePayload,
} from './analysis-queue.service';

/**
 * BullMQ worker for the analysis queue. Thin — the row state machine + AI call
 * live in AnalysisQueueService.processItem(), shared with the inline (no-Redis)
 * drainer so behaviour is identical. A thrown error here surfaces to BullMQ,
 * which retries per the job options set on enqueue.
 */
@Processor(ANALYSIS_QUEUE)
export class AnalysisQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisQueueProcessor.name);

  constructor(private readonly queue: AnalysisQueueService) {
    super();
  }

  async process(job: Job<AnalysisQueuePayload>): Promise<void> {
    this.logger.debug(`Processing analysis queue item ${job.data.itemId}`);
    await this.queue.processItem(job.data.itemId);
  }
}
