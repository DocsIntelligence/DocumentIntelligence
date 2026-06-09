import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  PipelineService,
  type IntelligenceJobPayload,
} from './pipeline.service';

export const INTEL_QUEUE = 'doc-intelligence';

/**
 * BullMQ worker for Document-Intelligence jobs. Thin — all logic lives in
 * PipelineService, shared with the inline (no-Redis) path so behaviour is
 * identical. A thrown error surfaces to BullMQ, which retries per job options.
 */
@Processor(INTEL_QUEUE)
export class IntelligenceProcessor extends WorkerHost {
  private readonly logger = new Logger(IntelligenceProcessor.name);

  constructor(private readonly pipeline: PipelineService) {
    super();
  }

  async process(job: Job<IntelligenceJobPayload>): Promise<void> {
    this.logger.debug(`Processing intelligence job ${job.data.jobId}`);
    await this.pipeline.run(job.data);
  }
}
