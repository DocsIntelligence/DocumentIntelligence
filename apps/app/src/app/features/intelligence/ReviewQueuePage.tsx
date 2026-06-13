import { Badge, Button, Spinner } from '@org/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  useApproveRun,
  useBatch,
  useBatchRuns,
  useExtraction,
  useReviewQueue,
} from './queries';
import { ReviewExtraction } from './ReviewExtraction';
import { ViewOriginalButton } from './ViewOriginalButton';
import { ArrowRightIcon, FileTextIcon, InboxIcon } from './icons';

/** Unified entry the stepper walks (from the review queue OR a batch's runs). */
interface QueueEntry {
  pipelineRunId: string;
  sourceDocumentId: string;
  filename: string;
  documentTypeKey: string | null;
  status: string;
  overallConfidence?: number | null;
}

// Runs that have something to review/inspect (an extraction exists).
const OPENABLE = ['needs_review', 'completed', 'approved'];
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  needs_review: 'warning',
  completed: 'success',
  approved: 'success',
};

/**
 * Review queue (docs/07 P4.4). Two modes:
 *  - LIST: everything to review; pick one to focus, or "Review all".
 *  - FOCUSED: a single-document stepper with Prev / Next and "Approve & next".
 *
 * Scope:
 *  - Global (`/review-queue`): only runs PARKED for review (needs_review).
 *  - Batch (`?batch=<id>`): ALL the batch's documents (needs_review + done), so
 *    a reviewer can step through the whole batch with Prev/Next, not just the
 *    parked ones. Approve is offered only on runs still awaiting review.
 */
export function ReviewQueuePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const batchId = params.get('batch') ?? undefined;
  const docParam = params.get('doc') ?? undefined;

  // Both scopes are server-paginated (docs/09 #9). The stepper walks one large
  // page (up to 500) of openable runs (batch) / parked items (global).
  const reviewQueue = useReviewQueue(batchId, 0, 500);
  const batchRuns = useBatchRuns(batchId, { openable: true, pageSize: 500 });
  const batch = useBatch(batchId).data; // summary only (name) — runs come above
  const isLoading = batchId ? batchRuns.isLoading : reviewQueue.isLoading;

  // Batch scope walks every openable doc in the batch (needs_review first);
  // global scope walks the parked queue only.
  const items = useMemo<QueueEntry[]>(() => {
    if (batchId) {
      return (batchRuns.data?.items ?? [])
        .filter((r) => OPENABLE.includes(r.status))
        .map((r) => ({
          pipelineRunId: r.id,
          sourceDocumentId: r.sourceDocumentId,
          filename: r.filename,
          documentTypeKey: r.documentTypeKey,
          status: r.status,
        }))
        .sort(
          (a, b) =>
            (a.status === 'needs_review' ? 0 : 1) -
            (b.status === 'needs_review' ? 0 : 1),
        );
    }
    return (reviewQueue.data?.items ?? []).map((i) => ({
      pipelineRunId: i.pipelineRunId,
      sourceDocumentId: i.sourceDocumentId,
      filename: i.filename,
      documentTypeKey: i.documentTypeKey,
      status: 'needs_review',
      overallConfidence: i.overallConfidence,
    }));
  }, [batchId, batchRuns.data?.items, reviewQueue.data?.items]);

  const count = items.length;
  const pendingCount = items.filter((i) => i.status === 'needs_review').length;
  // null = list view; a number = focused review at that index.
  const [current, setCurrent] = useState<number | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  // Deep-link: `?doc=<sourceId>` opens that document focused (e.g. "Open" from
  // the batch detail), once, so it can still be navigated with Prev/Next.
  useEffect(() => {
    if (autoOpened || !docParam || current !== null || count === 0) return;
    const idx = items.findIndex((i) => i.sourceDocumentId === docParam);
    if (idx >= 0) {
      setCurrent(idx);
      setAutoOpened(true);
    }
  }, [autoOpened, docParam, current, count, items]);

  // Keep the focused index valid as the list changes (e.g. after approving).
  useEffect(() => {
    if (current === null) return;
    if (count === 0) setCurrent(null);
    else if (current >= count) setCurrent(count - 1);
  }, [count, current]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-xl bg-secondary/40"
          />
        ))}
      </div>
    );
  }

  // ─── Focused review stepper ──────────────────────────────────────────────
  if (current !== null && items[current]) {
    return (
      <FocusedReview
        entry={items[current]}
        index={current}
        count={count}
        batchId={batchId}
        advanceOnApprove={!!batchId}
        onPrev={() => setCurrent((c) => Math.max(0, (c ?? 0) - 1))}
        onNext={() => setCurrent((c) => Math.min(count - 1, (c ?? 0) + 1))}
        onClose={() => setCurrent(null)}
      />
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <InboxIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t('intelligence.queue.title', 'Review queue')}
            </h1>
            <p className="mt-0.5 text-sm text-foreground/60">
              {batchId
                ? t('intelligence.queue.subtitleBatch', 'In {{name}}', {
                    name:
                      batch?.name ??
                      t('intelligence.queue.thisBatch', 'this batch'),
                  })
                : t(
                    'intelligence.queue.subtitle',
                    'Documents the pipeline flagged for a human check before finalizing.',
                  )}
              {count > 0 &&
                ` · ${t('intelligence.queue.count', '{{n}} to review', { n: pendingCount })}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <Button size="sm" onClick={() => setCurrent(0)} className="gap-1.5">
              {batchId
                ? t('intelligence.queue.reviewBatch', 'Review batch')
                : t('intelligence.queue.reviewAll', 'Review all')}
              <ArrowRightIcon className="size-3.5" />
            </Button>
          )}
          {batchId && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/batches/${batchId}`}>
                {t('intelligence.queue.backToBatch', 'Back to batch')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {count > 0 ? (
        <div className="space-y-3">
          {items.map((item, i) => {
            const pct =
              item.overallConfidence != null
                ? Math.round(item.overallConfidence * 100)
                : null;
            return (
              <button
                type="button"
                key={item.pipelineRunId}
                onClick={() => setCurrent(i)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-background p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <span className="inline-flex size-9 flex-none items-center justify-center rounded-lg bg-secondary/60 text-foreground/70">
                  <FileTextIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.filename}
                  </p>
                  <p className="truncate text-xs text-foreground/50">
                    {item.documentTypeKey ??
                      t('intelligence.queue.unknownType', 'Unknown type')}
                  </p>
                </div>
                {batchId && (
                  <Badge
                    variant={STATUS_VARIANT[item.status] ?? 'secondary'}
                    outline
                  >
                    {item.status.replace(/_/g, ' ')}
                  </Badge>
                )}
                {pct != null && (
                  <Badge variant={pct >= 85 ? 'success' : 'warning'} outline>
                    {pct}%
                  </Badge>
                )}
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {t('intelligence.queue.review', 'Review')}
                  <ArrowRightIcon className="size-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckMark />
          </span>
          <p className="mt-3 font-medium text-foreground">
            {t('intelligence.queue.emptyTitle', 'All caught up')}
          </p>
          <p className="mt-1 text-sm text-foreground/55">
            {t('intelligence.queue.empty', 'Nothing to review here.')}
          </p>
        </div>
      )}
    </div>
  );
}

/** One document in the focused review stepper. */
function FocusedReview({
  entry,
  index,
  count,
  batchId,
  advanceOnApprove,
  onPrev,
  onNext,
  onClose,
}: {
  entry: QueueEntry;
  index: number;
  count: number;
  batchId?: string;
  advanceOnApprove: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useExtraction(entry.sourceDocumentId, true);
  const approve = useApproveRun(batchId);
  const extraction = data?.extraction;
  const isLast = index >= count - 1;
  const canApprove = entry.status === 'needs_review';

  // Approve, then move on. In batch scope the item stays in the list (its
  // status flips to completed) so we advance manually; in the global queue the
  // approved item drops out and the index lands on the next one automatically.
  const onApprove = () =>
    approve.mutate(entry.pipelineRunId, {
      onSuccess: () => {
        if (advanceOnApprove && !isLast) onNext();
      },
    });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Stepper header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
            <ArrowRightIcon className="size-3.5 rotate-180" />
            {t('intelligence.queue.backToList', 'Back to list')}
          </Button>
          <span className="text-sm tabular-nums text-foreground/60">
            {t('intelligence.queue.progress', '{{n}} of {{total}}', {
              n: index + 1,
              total: count,
            })}
          </span>
          <Badge
            variant={STATUS_VARIANT[entry.status] ?? 'secondary'}
            outline
          >
            {entry.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <ViewOriginalButton sourceId={entry.sourceDocumentId} />
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={index === 0}
            className="gap-1"
          >
            <ArrowRightIcon className="size-3.5 rotate-180" />
            {t('common.prev', 'Prev')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={isLast}
            className="gap-1"
          >
            {t('common.next', 'Next')}
            <ArrowRightIcon className="size-3.5" />
          </Button>
          {canApprove && (
            <Button
              size="sm"
              onClick={onApprove}
              disabled={approve.isPending || !extraction}
            >
              {isLast
                ? t('intelligence.queue.approve', 'Approve')
                : t('intelligence.queue.approveNext', 'Approve & next')}
            </Button>
          )}
        </div>
      </div>

      <div>
        <p className="truncate text-sm font-medium text-foreground">
          {entry.filename}
        </p>
        <p className="truncate text-xs text-foreground/50">
          {entry.documentTypeKey ??
            t('intelligence.queue.unknownType', 'Unknown type')}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : extraction ? (
        <ReviewExtraction
          key={extraction.id}
          extraction={extraction}
          sourceId={entry.sourceDocumentId}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-foreground/55">
          {t('intelligence.queue.noExtraction', 'No extraction to review.')}
        </div>
      )}
    </div>
  );
}

function CheckMark() {
  return (
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}
