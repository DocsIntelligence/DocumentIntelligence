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
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIntelligenceService } from './services-context';

const CONCURRENCY = 2;

export interface BulkAnalyzeTarget {
  id: string;
  title: string;
}

interface BulkAnalyzeDialogProps {
  targets: BulkAnalyzeTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback fired after the run completes (success or partial). */
  onComplete?: (summary: { ok: number; failed: number }) => void;
}

type RowStatus = 'pending' | 'running' | 'analyzed' | 'cached' | 'failed';

interface RowState {
  status: RowStatus;
  error?: string;
}

/**
 * Multi-document analyze runner. Iterates the selected documents with a small
 * concurrency cap, calling the per-doc analyze endpoint and updating each row
 * live. `force` toggles the server-side content-hash cache: off (default)
 * lets unchanged docs short-circuit; on forces a fresh AI run.
 */
export function BulkAnalyzeDialog({
  targets,
  open,
  onOpenChange,
  onComplete,
}: BulkAnalyzeDialogProps) {
  const { t } = useTranslation();
  const svc = useIntelligenceService();
  const qc = useQueryClient();
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [states, setStates] = useState<Record<string, RowState>>({});
  const cancelRef = useRef(false);

  // Reset state every time the dialog opens with a new set.
  useEffect(() => {
    if (!open) return;
    setForce(false);
    setRunning(false);
    setDone(false);
    setStates(
      Object.fromEntries(
        targets.map((t) => [t.id, { status: 'pending' as RowStatus }]),
      ),
    );
    cancelRef.current = false;
  }, [open, targets]);

  const counts = (() => {
    let ok = 0;
    let failed = 0;
    let running = 0;
    for (const t of targets) {
      const s = states[t.id]?.status;
      if (s === 'analyzed' || s === 'cached') ok += 1;
      else if (s === 'failed') failed += 1;
      else if (s === 'running') running += 1;
    }
    return { ok, failed, running };
  })();

  const total = targets.length;
  const finished = counts.ok + counts.failed;
  const progress = total === 0 ? 0 : Math.round((finished / total) * 100);

  const start = async () => {
    if (running || total === 0) return;
    setRunning(true);
    setDone(false);
    cancelRef.current = false;

    let cursor = 0;

    const runOne = async () => {
      while (!cancelRef.current) {
        const i = cursor++;
        if (i >= targets.length) return;
        const target = targets[i];
        setStates((prev) => ({
          ...prev,
          [target.id]: { status: 'running' },
        }));
        try {
          const before = await svc
            .getDocumentAnalysis(target.id)
            .catch(() => null);
          const beforeId = before?.analysis?.id ?? null;
          const run = await svc.analyzeDocument(target.id, { force });
          // If the returned runId equals the previous latest, it was a cached
          // short-circuit (server returned the existing row). Show that
          // distinction so the user knows what actually happened.
          const wasCached = !force && beforeId !== null && run.id === beforeId;
          setStates((prev) => ({
            ...prev,
            [target.id]: { status: wasCached ? 'cached' : 'analyzed' },
          }));
        } catch (e) {
          const err = e as { response?: { data?: { message?: string } } };
          setStates((prev) => ({
            ...prev,
            [target.id]: {
              status: 'failed',
              error: err?.response?.data?.message ?? 'Failed',
            },
          }));
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, targets.length) },
      runOne,
    );
    await Promise.all(workers);

    setRunning(false);
    setDone(true);
    // Refresh anything that depends on analysis presence.
    qc.invalidateQueries({ queryKey: ['intelligence', 'analysis-status'] });
    qc.invalidateQueries({ queryKey: ['intelligence', 'analysis'] });
    onComplete?.({ ok: counts.ok, failed: counts.failed });
  };

  const cancel = () => {
    cancelRef.current = true;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Don't allow close-by-overlay while a run is in-flight.
        if (running && !v) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('documents.bulk.title', `Analyze ${total} document${total === 1 ? '' : 's'}`)}
          </DialogTitle>
          <DialogDescription>
            {t(
              'documents.bulk.desc',
              'Runs AI analysis (summary, parties, key dates, risk flags + cited-law health) on each selected document.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-secondary/15 p-3 text-sm">
            <Checkbox
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
              disabled={running}
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

          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-foreground/55">
            <span>
              {finished} / {total}{' '}
              {t('documents.bulk.finished', 'finished')}
            </span>
            <span>
              {counts.ok > 0 && (
                <span className="text-success-foreground mr-2">
                  ✓ {counts.ok}
                </span>
              )}
              {counts.failed > 0 && (
                <span className="text-error">✗ {counts.failed}</span>
              )}
            </span>
          </div>

          <ScrollArea className="h-56 rounded-md border border-border">
            <ul className="divide-y divide-border/70">
              {targets.map((t) => (
                <RowItem
                  key={t.id}
                  title={t.title}
                  state={states[t.id]}
                />
              ))}
            </ul>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {!running && !done && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button size="sm" onClick={start} disabled={total === 0}>
                {t('documents.bulk.start', 'Start')}
              </Button>
            </>
          )}
          {running && (
            <Button variant="outline" size="sm" onClick={cancel}>
              {t('documents.bulk.stop', 'Stop after current')}
            </Button>
          )}
          {done && (
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
  state,
}: {
  title: string;
  state: RowState | undefined;
}) {
  const { t } = useTranslation();
  const status = state?.status ?? 'pending';
  const tone =
    status === 'analyzed'
      ? 'text-success-foreground'
      : status === 'cached'
        ? 'text-foreground/55'
        : status === 'failed'
          ? 'text-error'
          : status === 'running'
            ? 'text-primary'
            : 'text-foreground/40';
  const label =
    status === 'analyzed'
      ? t('documents.bulk.statusAnalyzed', 'Analyzed')
      : status === 'cached'
        ? t('documents.bulk.statusCached', 'Cached (unchanged)')
        : status === 'failed'
          ? state?.error ?? t('documents.bulk.statusFailed', 'Failed')
          : status === 'running'
            ? t('documents.bulk.statusRunning', 'Running…')
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
