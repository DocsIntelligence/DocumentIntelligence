import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SearchIndexService } from './search-index.service';

export const SEARCH_QUEUE = 'search-index';
export const SEARCH_QUEUE_ENABLED = 'SEARCH_QUEUE_ENABLED';

/** What we enqueue for async (re)indexing of a single entity. */
export interface SearchIndexJob {
  kind: 'document' | 'source';
  refId: string;
  /** 'upsert' rebuilds text + embedding; 'remove' deletes the index row. */
  op: 'upsert' | 'remove';
}

@Processor(SEARCH_QUEUE)
export class SearchIndexProcessor extends WorkerHost {
  constructor(private readonly index: SearchIndexService) {
    super();
  }

  async process(job: Job<SearchIndexJob>): Promise<void> {
    const { kind, refId, op } = job.data;
    if (op === 'remove') {
      await this.index.removeNow(kind, refId);
    } else {
      await this.index.indexNow(kind, refId);
    }
  }
}
