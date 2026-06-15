import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Progress,
  ScrollArea,
} from '@org/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useAnalysisQueueBatch,
  useEnqueueAnalysisBatch,
} from '../intelligence/queries';

export interface BulkAnalyzeTarget {
  id: string;
  title: string;
}

interface BulkAnalyzeDialogProps {
  targets: BulkAnalyzeTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Bulk analysis flow backed by the server queue (AnalysisQueueItem +
 * AnalysisQueueService). The dialog submits a batch once and then polls
 * `/intelligence/analysis-queue/:batchId` until the queue drains. Closing the
 * dialog DOES NOT cancel work — the queue indicator on the documents list
 * continues to surface in-flight batches, and the user can come back to this
 * dialog (or reload) and still see progress.
 *
 * Status transitions (server-driven):
 *   queued → running → done | cached | failed
 * `cached` means the document's text was unchanged since its last analysis and
 * `force` was off — the server returned the existing run without spending AI
 * tokens.
 */
export function BulkAnalyzeDialog({
  targets,
  open,
  onOpenChange,
}: BulkAnalyzeDialogProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const enqueue = useEnqueueAnalysisBatch();
  const [force, setForce] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);

  // Map docId → title so we can label rows the server only knows by id.
  const titleById = new Map(targets.map((tg) => [tg.id, tg.title]));

  const batch = useAnalysisQueueBatch(batchId ?? undefined, open && !!batchId);

  // Reset on open (new dialog session = clean state).
  useEffect(() => {
    if (!open) return;
    setForce(false);
    setBatchId(null);
  }, [open, targets]);

  // When a poll observes completion, invalidate the per-doc analysis caches so
  // the documents-list status pills refresh without a manual reload.
  useEffect(() => {
    if (batch.data?.isComplete) {
      qc.invalidateQueries({ queryKey: ['intelligence', 'analysis-status'] });
      qc.invalidateQueries({ queryKey: ['intelligence', 'analysis'] });
    }
  }, [batch.data?.isComplete, qc]);

  const start = async () => {
    try {
      const res = await enqueue.mutateAsync({
        documentIds: targets.map((t) => t.id),
        force,
      });
      setBatchId(res.batchId);
      toast.success(
        t(
          'documents.bulk.enqueued',
          `Queued ${res.counts.total} document${res.counts.total === 1 ? '' : 's'} for analysis`,
        ),
      );
    } catch {
      // useEnqueueAnalysisBatch already toasts the error.
    }
  };

  const data = batch.data;
  const counts = data?.counts ?? {
    queued: targets.length,
    running: 0,
    done: 0,
    cached: 0,
    failed: 0,
    total: targets.length,
  };
  const finished = counts.done + counts.cached + counts.failed;
  const progress = counts.total === 0 ? 0 : Math.round((finished / counts.total) * 100);
  const hasStarted = !!batchId;
  const isComplete = !!data?.isComplete;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(
              'documents.bulk.title',
              `Analyze ${targets.length} document${targets.length === 1 ? '' : 's'}`,
            )}
          </DialogTitle>
          <DialogDescription>
            {hasStarted
              ? t(
                  'documents.bulk.descRunning',
                  'Your documents are queued — analysis runs on the server. You can close this dialog; work continues in the background.',
                )
              : t(
                  'documents.bulk.desc',
                  'Submits each document to a server-side queue. AI analysis (summary, parties, dates, risk flags + cited-law health) runs in the background.',
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {!hasStarted && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-secondary/15 p-3 text-sm">
              <Checkbox
                checked={force}
                onCheckedChange={(v) => setForce(v === true)}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <Label className="cursor-pointer text-sm">
                  {t('documents.bulk.force', 'Force re-analyze')}
                </Label>
                <p className="text-xs text-foreground/55">
                  {t(
                    'documents.bulk.forceHelp',
                    'Off (default): if a document\u2019s text hasn\u2019t changed since its last analysis, the cached result is returned instantly (no AI cost). On: every document gets a fresh AI analysis.',
                  )}
                </p>
              </span>
            </label>
          )}

          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-foreground/55">
            <span>
              {finished} / {counts.total}{' '}
              {t('documents.bulk.finished', 'finished')}
              {counts.running > 0 && (
                <span className="text-primary">
                  {' '}
                  · {counts.running} {t('documents.bulk.running', 'running')}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              {counts.done > 0 && (
                <span className="text-success-foreground">
                  ✓ {counts.done}
                </span>
              )}
              {counts.cached > 0 && (
                <span className="text-foreground/55">
                  ↻ {counts.cached}
                </span>
              )}
              {counts.failed > 0 && (
                <span className="text-error">✗ {counts.failed}</span>
              )}
            </span>
          </div>

          <ScrollArea className="h-56 rounded-md border border-border">
            <ul className="divide-y divide-border/70">
              {(data?.items ?? targets.map((tg) => ({
                id: tg.id,
                documentId: tg.id,
                status: 'queued' as const,
                error: null,
              }))).map((item) => (
                <RowItem
                  key={item.id}
                  title={titleById.get(item.documentId) ?? ''}
                  status={item.status}
                  error={'error' in item ? item.error : null}
                />
              ))}
            </ul>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {!hasStarted && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                size="sm"
                onClick={start}
                disabled={targets.length === 0 || enqueue.isPending}
              >
                {enqueue.isPending
                  ? t('documents.bulk.enqueuing', 'Queuing\u2026')
                  : t(
                      'documents.bulk.queue',
                      `Queue ${targets.length} document${targets.length === 1 ? '' : 's'}`,
                    )}
              </Button>
            </>
          )}
          {hasStarted && !isComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t('documents.bulk.runInBackground', 'Run in background')}
            </Button>
          )}
          {hasStarted && isComplete && (
            <Button size="sm" onClick={() => onOpenChange(false)}>
              {t('common.done', 'Done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowItem({
  title,
  status,
  error,
}: {
  title: string;
  status: 'queued' | 'running' | 'done' | 'cached' | 'failed';
  error: string | null;
}) {
  const { t } = useTranslation();
  const tone =
    status === 'done'
      ? 'text-success-foreground'
      : status === 'cached'
        ? 'text-foreground/55'
        : status === 'failed'
          ? 'text-error'
          : status === 'running'
            ? 'text-primary'
            : 'text-foreground/40';
  const label =
    status === 'done'
      ? t('documents.bulk.statusAnalyzed', 'Analyzed')
      : status === 'cached'
        ? t('documents.bulk.statusCached', 'Cached (unchanged)')
        : status === 'failed'
          ? error ?? t('documents.bulk.statusFailed', 'Failed')
          : status === 'running'
            ? t('documents.bulk.statusRunning', 'Running\u2026')
            : t('documents.bulk.statusPending', 'Queued');
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-foreground">
        {title || t('common.untitled', 'Untitled')}
      </span>
      <span className={`shrink-0 text-xs ${tone}`}>{label}</span>
    </li>
  );
}
