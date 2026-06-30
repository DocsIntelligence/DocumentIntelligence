import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
} from '@org/ui';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalysis, useRunAnalysis } from '../intelligence/queries';
import { documentHref } from './document-href';

interface AnalyzeDocumentDialogProps {
  documentId: string;
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Pull a human message out of an Axios/Error/unknown rejection. */
function extractErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data?.message;
  if (typeof data === 'string' && data.trim()) return data;
  if (Array.isArray(data) && typeof data[0] === 'string') return data[0];
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function relativeDate(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Single-document analyze panel: opens from the documents list. Shows whether
 * the doc has been analysed (and a preview of the cached result), and lets the
 * user trigger a fresh analysis or force a re-analyse (bypassing the
 * content-hash cache).
 *
 * "Use existing" = just close + navigate the user to the full insights panel
 * on the document edit page. "Re-analyse" calls analyze with force=true.
 */
export function AnalyzeDocumentDialog({
  documentId,
  title,
  open,
  onOpenChange,
}: AnalyzeDocumentDialogProps) {
  const { t } = useTranslation();
  const analysisQuery = useAnalysis(open ? documentId : undefined, 'document');
  const run = useRunAnalysis(documentId, 'document');

  const analysis = analysisQuery.data?.analysis ?? null;
  const hasAnalysis = !!analysis;

  // Persistent, in-dialog feedback for the last run (the toast is transient).
  // The server returns descriptive messages — e.g. an empty document yields
  // "Nothing to analyse — this document has no extractable text yet." — so we
  // surface them verbatim rather than a generic "failed".
  const runError = run.isError
    ? extractErrorMessage(run.error, t('documents.analyze.failed', 'Analysis failed.'))
    : null;

  const onAnalyze = async (force: boolean) => {
    // The mutation's onError already surfaces a toast; swallow the rejection
    // here so the click handler doesn't leave an unhandled promise rejection.
    try {
      await run.mutateAsync({ force });
    } catch {
      /* handled by useRunAnalysis onError */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t('documents.analyze.title', 'Analyze document')}
            {title ? <span className="font-normal"> — {title}</span> : null}
          </DialogTitle>
          <DialogDescription>
            {hasAnalysis
              ? t(
                  'documents.analyze.haveCached',
                  'This document already has an analysis. You can open it, or re-run to refresh.',
                )
              : t(
                  'documents.analyze.fresh',
                  'Run a fresh AI analysis: summary, parties, obligations, key dates, risk flags + cited-law health.',
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {analysisQuery.isLoading || run.isPending ? (
            <div className="flex h-24 items-center justify-center gap-2 text-sm text-foreground/60">
              <Spinner size="sm" />
              {run.isPending
                ? t('documents.analyze.running', 'Running analysis…')
                : t('common.loading', 'Loading…')}
            </div>
          ) : analysis ? (
            <CachedPreview analysis={analysis} />
          ) : (
            <p className="rounded-md border border-dashed border-border bg-secondary/35 px-3 py-6 text-center text-sm text-foreground/60">
              {t(
                'documents.analyze.notAnalyzed',
                'Not analyzed yet. Run analysis to see summary, parties, dates and risk flags.',
              )}
            </p>
          )}

          {runError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
            >
              <span aria-hidden className="mt-0.5 flex-none">
                ⚠
              </span>
              <span>{runError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={run.isPending}
          >
            {t('common.close', 'Close')}
          </Button>

          {hasAnalysis && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={documentHref({ id: documentId })}>
                  {t('documents.analyze.viewExisting', 'Open full insights')}
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={run.isPending}
                onClick={() => onAnalyze(true)}
              >
                {t('documents.analyze.reanalyze', 'Re-analyze (force)')}
              </Button>
            </>
          )}

          {!hasAnalysis && (
            <Button
              size="sm"
              disabled={run.isPending}
              onClick={() => onAnalyze(false)}
            >
              {run.isPending
                ? t('documents.analyze.running', 'Running…')
                : t('documents.analyze.run', 'Analyze now')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CachedPreview({
  analysis,
}: {
  analysis: {
    summary: string | null;
    parties: { name: string; role?: string }[] | null;
    keyDates: { label: string; date?: string }[] | null;
    riskFlags: { severity: string; note: string }[] | null;
    createdAt: string;
  };
}) {
  const { t } = useTranslation();
  const partyCount = analysis.parties?.length ?? 0;
  const dateCount = analysis.keyDates?.length ?? 0;
  const riskCount = analysis.riskFlags?.length ?? 0;
  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/35 p-3">
      <div className="flex items-center justify-between text-xs text-foreground/55">
        <span>
          {t('documents.analyze.lastRun', 'Last analyzed')}{' '}
          <span className="font-medium text-foreground/75">
            {relativeDate(analysis.createdAt)}
          </span>
        </span>
        <span>
          {partyCount} {t('documents.analyze.parties', 'parties')} · {dateCount}{' '}
          {t('documents.analyze.dates', 'dates')} · {riskCount}{' '}
          {t('documents.analyze.risks', 'risks')}
        </span>
      </div>
      {analysis.summary && (
        <p className="line-clamp-4 text-sm leading-relaxed text-foreground">
          {analysis.summary}
        </p>
      )}
      {(analysis.parties ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(analysis.parties ?? []).slice(0, 6).map((p, i) => (
            <span
              key={`${p.name}-${i}`}
              className="rounded-full bg-primary/50 px-2 py-0.5 text-[11px] text-primary"
              title={p.role}
            >
              {p.name}
              {p.role ? ` · ${p.role}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
