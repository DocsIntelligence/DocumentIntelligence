import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  ScrollArea,
  Spinner,
} from '@org/ui';
import { useTranslation } from 'react-i18next';
import { useActiveAnalysisQueue } from '../intelligence/queries';

/**
 * Header pill that shows in-flight (and just-completed) bulk-analysis batches.
 * Click to expand a popover with per-batch progress + per-item status. Polls
 * the server every 2s while batches are draining, then backs off to 15s.
 *
 * Hidden when there's no activity to surface — keeps the toolbar clean.
 */
export function AnalysisQueueIndicator() {
  const { t } = useTranslation();
  const { data } = useActiveAnalysisQueue();
  const batches = data ?? [];
  if (batches.length === 0) return null;

  const totals = batches.reduce(
    (acc, b) => {
      acc.queued += b.counts.queued;
      acc.running += b.counts.running;
      acc.done += b.counts.done;
      acc.cached += b.counts.cached;
      acc.failed += b.counts.failed;
      acc.inFlight += b.isComplete ? 0 : 1;
      return acc;
    },
    { queued: 0, running: 0, done: 0, cached: 0, failed: 0, inFlight: 0 },
  );

  const inFlightCount = totals.queued + totals.running;
  const label =
    inFlightCount > 0
      ? t(
          'documents.queueIndicator.inFlight',
          `Analyzing ${inFlightCount} document${inFlightCount === 1 ? '' : 's'}…`,
        )
      : t('documents.queueIndicator.recent', 'Recent analyses');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border bg-secondary/15 px-3 py-1 text-xs font-medium text-foreground/75 transition hover:bg-secondary/30"
          aria-label={label}
        >
          {inFlightCount > 0 ? (
            <Spinner size="sm" className="text-primary" />
          ) : (
            <span aria-hidden className="text-success-foreground">
              ✓
            </span>
          )}
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium text-foreground/70">
          <span>
            {t('documents.queueIndicator.heading', 'Analysis queue')}
          </span>
          <span className="text-[10px] text-foreground/45">
            {batches.length}{' '}
            {batches.length === 1
              ? t('documents.queueIndicator.batch', 'batch')
              : t('documents.queueIndicator.batches', 'batches')}
          </span>
        </div>
        <ScrollArea className="max-h-80">
          <ul className="divide-y divide-border/70">
            {batches.map((b) => {
              const finished = b.counts.done + b.counts.cached + b.counts.failed;
              const pct =
                b.counts.total === 0
                  ? 0
                  : Math.round((finished / b.counts.total) * 100);
              return (
                <li key={b.batchId} className="space-y-2 px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">
                      {finished} / {b.counts.total}{' '}
                      {b.isComplete
                        ? t('documents.queueIndicator.done', 'completed')
                        : t('documents.queueIndicator.progress', 'in progress')}
                    </span>
                    <span className="text-foreground/50">
                      {new Date(b.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <Progress value={pct} />
                  <div className="flex items-center gap-3 text-[11px] text-foreground/55">
                    {b.counts.done > 0 && (
                      <span className="text-success-foreground">
                        ✓ {b.counts.done}
                      </span>
                    )}
                    {b.counts.cached > 0 && <span>↻ {b.counts.cached}</span>}
                    {b.counts.running > 0 && (
                      <span className="text-primary">
                        ⏵ {b.counts.running}
                      </span>
                    )}
                    {b.counts.queued > 0 && <span>· {b.counts.queued} queued</span>}
                    {b.counts.failed > 0 && (
                      <span className="text-error">✗ {b.counts.failed}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
