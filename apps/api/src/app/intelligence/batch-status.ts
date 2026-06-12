import { BatchStatus, PipelineRunStatus } from '@prisma/client';

/**
 * Single source of truth for deriving a batch's status + funnel counts from its
 * runs. Used both to PERSIST `Batch.status` on run transitions (so the column
 * can be filtered/sorted server-side) and to render live counts. Keeping the
 * bucket logic here means the stored status and the displayed status can never
 * drift.
 */

export interface BatchCounts {
  total: number;
  completed: number;
  needsReview: number;
  failed: number;
  archived: number;
  running: number;
}

export function deriveBatchCounts(
  runs: { status: PipelineRunStatus }[],
): BatchCounts {
  const total = runs.length;
  const count = (s: PipelineRunStatus) =>
    runs.filter((r) => r.status === s).length;
  const completed = count('completed') + count('approved');
  const needsReview = count('needs_review');
  const failed = count('failed') + count('rejected');
  const archived = count('archived');
  // Everything not yet terminal (queued + running).
  const running = total - completed - needsReview - failed - archived;
  return { total, completed, needsReview, failed, archived, running };
}

export function deriveBatchStatus(c: BatchCounts): BatchStatus {
  return c.running > 0
    ? BatchStatus.running
    : c.needsReview > 0
      ? BatchStatus.needs_review
      : c.failed === c.total && c.total > 0
        ? BatchStatus.failed
        : BatchStatus.completed;
}

/**
 * Workspace funnel totals from a `groupBy(status)` aggregate — the KPI tiles.
 * Same buckets as deriveBatchCounts, but summed across many runs at once.
 */
export function bucketTotals(
  grouped: { status: PipelineRunStatus; _count: { _all: number } }[],
): Omit<BatchCounts, 'total'> {
  const by = (s: PipelineRunStatus) =>
    grouped.find((g) => g.status === s)?._count._all ?? 0;
  return {
    completed: by('completed') + by('approved'),
    needsReview: by('needs_review'),
    failed: by('failed') + by('rejected'),
    archived: by('archived'),
    running: by('queued') + by('running'),
  };
}
