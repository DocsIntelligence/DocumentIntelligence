import { Badge, Button } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useApproveRun, useBatch, useReviewQueue } from './queries';
import { ArrowRightIcon, FileTextIcon, InboxIcon } from './icons';

/**
 * Review queue (docs/07 P4.4): pipeline runs parked for human review. Open one
 * to inspect/correct, then approve to finalize (export). Scoped to a single
 * batch via `?batch=<id>` so batches aren't mixed together.
 */
export function ReviewQueuePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const batchId = params.get('batch') ?? undefined;
  const { data: items, isLoading } = useReviewQueue(batchId);
  const { data: batch } = useBatch(batchId);
  const approve = useApproveRun(batchId);

  const count = items?.length ?? 0;

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
                      batch?.name ?? t('intelligence.queue.thisBatch', 'this batch'),
                  })
                : t(
                    'intelligence.queue.subtitle',
                    'Documents the pipeline flagged for a human check before finalizing.',
                  )}
              {count > 0 &&
                ` · ${t('intelligence.queue.count', '{{n}} to review', { n: count })}`}
            </p>
          </div>
        </div>
        {batchId && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/batches/${batchId}`}>
              {t('intelligence.queue.backToBatch', 'Back to batch')}
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded-xl bg-secondary/40"
            />
          ))}
        </div>
      ) : count > 0 ? (
        <div className="space-y-3">
          {items?.map((item) => {
            const pct =
              item.overallConfidence != null
                ? Math.round(item.overallConfidence * 100)
                : null;
            return (
              <div
                key={item.pipelineRunId}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/40 hover:shadow-sm"
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
                {pct != null && (
                  <Badge variant={pct >= 85 ? 'success' : 'warning'} outline>
                    {pct}%
                  </Badge>
                )}
                <Link
                  to={`/analyze/${item.sourceDocumentId}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t('intelligence.queue.review', 'Review')}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
                <Button
                  size="sm"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(item.pipelineRunId)}
                >
                  {t('intelligence.queue.approve', 'Approve')}
                </Button>
              </div>
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
