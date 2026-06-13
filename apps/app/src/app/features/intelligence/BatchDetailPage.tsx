import {
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import {
  useApproveRun,
  useArchiveRun,
  useArchiveType,
  useBatch,
  useBatchRuns,
  useReprocessRun,
  useSchemaOptions,
} from './queries';
import { InboxIcon } from './icons';

const RUNS_PAGE_SIZE = 50;
/** Raw run statuses, for the filter chips (counts come from the server). */
const RUN_STATUSES = [
  'queued',
  'running',
  'needs_review',
  'completed',
  'approved',
  'archived',
  'failed',
  'rejected',
];

const RUN_VARIANT: Record<
  string,
  'success' | 'warning' | 'error' | 'info' | 'secondary'
> = {
  completed: 'success',
  approved: 'success',
  needs_review: 'warning',
  failed: 'error',
  rejected: 'error',
  archived: 'secondary',
  running: 'info',
  queued: 'secondary',
};

/** Statuses that can still be skipped (not already terminal-done). */
const ARCHIVABLE = new Set(['queued', 'running', 'needs_review', 'failed']);

const FUNNEL_SEGMENTS: {
  key: 'inProgress' | 'needsReview' | 'completed' | 'archived' | 'failed';
  label: string;
  bar: string;
}[] = [
  { key: 'inProgress', label: 'In progress', bar: 'bg-info' },
  { key: 'needsReview', label: 'To review', bar: 'bg-warning' },
  { key: 'completed', label: 'Done', bar: 'bg-success' },
  { key: 'archived', label: 'Archived', bar: 'bg-foreground/30' },
  { key: 'failed', label: 'Failed', bar: 'bg-error' },
];

/**
 * A batch's documents: a funnel (status flow) + classified-type histogram, then
 * the run list with per-doc and bulk "skip" (archive). docs/07 P4.3 + routing.
 */
export function BatchDetailPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { id } = useParams<{ id: string }>();
  const { data: batch, isLoading } = useBatch(id);
  const archive = useArchiveRun(id);
  const bulk = useArchiveType(id);
  const approve = useApproveRun(id);
  const reprocess = useReprocessRun(id);
  const schemaOptions = useSchemaOptions();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Runs are server-paginated (docs/09 #9) — a batch can hold ~1000 docs.
  const runsQuery = useBatchRuns(id, {
    status: statusFilter ?? undefined,
    page,
    pageSize: RUNS_PAGE_SIZE,
  });
  const runs = runsQuery.data?.items ?? [];
  const runsTotal = runsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(runsTotal / RUNS_PAGE_SIZE));

  const filterBy = (status: string | null) => {
    setStatusFilter(status);
    setPage(0);
  };

  if (isLoading || !batch) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <Spinner />
      </div>
    );
  }

  // Tolerate an older API response (pre-funnel) so the page never crashes.
  const funnel = batch.funnel ?? {
    inProgress: 0,
    needsReview: 0,
    completed: 0,
    archived: 0,
    failed: 0,
  };
  const typeHistogram = batch.typeHistogram ?? [];

  const skipType = async (documentTypeKey: string) => {
    const ok = await confirm({
      title: t('intelligence.batches.skipTypeTitle2', 'Skip all of this type?'),
      description: t(
        'intelligence.batches.skipTypeDesc',
        'They will be archived (not extracted). This cannot be undone.',
      ),
      confirmLabel: t('intelligence.batches.skip', 'Skip'),
      variant: 'destructive',
    });
    // Archivable runs are resolved server-side (no need to hold every id here).
    if (ok) bulk.mutate({ documentTypeKey, reason: `Skipped type ${documentTypeKey}` });
  };

  const maxCount = Math.max(1, ...typeHistogram.map((h) => h.count));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {batch.name ?? t('intelligence.batches.title', 'Batches')}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {t(
              'intelligence.batches.countsArchived',
              '{{c}}/{{t}} done · {{r}} to review · {{a}} archived · {{f}} failed',
              {
                c: batch.completed,
                t: batch.total,
                r: batch.needsReview,
                a: batch.archived ?? 0,
                f: batch.failed,
              },
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {batch.needsReview > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/review-queue?batch=${id}`} className="gap-1.5">
                <InboxIcon className="size-3.5" />
                {t('intelligence.batches.goReview', 'Review {{n}}', {
                  n: batch.needsReview,
                })}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/batches">{t('common.back', 'Back')}</Link>
          </Button>
        </div>
      </div>

      {/* Funnel */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-secondary">
            {FUNNEL_SEGMENTS.map((s) => {
              const n = funnel[s.key];
              const pct = batch.total ? (n / batch.total) * 100 : 0;
              return pct > 0 ? (
                <div
                  key={s.key}
                  className={s.bar}
                  style={{ width: `${pct}%` }}
                  title={`${s.label}: ${n}`}
                />
              ) : null;
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            {FUNNEL_SEGMENTS.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.bar}`} />
                {t(`intelligence.funnel.${s.key}`, s.label)}:{' '}
                <strong>{funnel[s.key]}</strong>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Classified-type histogram + per-type skip */}
      {typeHistogram.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <p className="text-sm font-medium">
              {t('intelligence.batches.byType', 'By classified type')}
            </p>
            {typeHistogram.map((h) => (
              <div
                key={h.documentTypeKey}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-56 truncate" title={h.documentTypeKey}>
                  {h.documentTypeKey}
                </span>
                <div className="flex-1">
                  <div
                    className="h-2 rounded-full bg-primary/60"
                    style={{ width: `${(h.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums">{h.count}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-error"
                  disabled={bulk.isPending}
                  onClick={() => skipType(h.documentTypeKey)}
                >
                  {t('intelligence.batches.skipType', 'Skip type')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Status filter chips (server-filtered) */}
      <div className="flex flex-wrap gap-2">
        <Chip active={!statusFilter} onClick={() => filterBy(null)}>
          {t('common.all', 'All')} ({batch.total})
        </Chip>
        {RUN_STATUSES.map((status) => (
          <Chip
            key={status}
            active={statusFilter === status}
            onClick={() => filterBy(statusFilter === status ? null : status)}
          >
            {status}
          </Chip>
        ))}
      </div>

      {/* Run list */}
      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{r.filename}</p>
                <p className="text-xs text-foreground/50">
                  {r.documentTypeKey ??
                    t('intelligence.batches.unclassified', 'unclassified')}
                  {r.status === 'archived' && r.archivedReason
                    ? ` · ${r.archivedReason}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={RUN_VARIANT[r.status] ?? 'secondary'}>
                  {r.status}
                </Badge>
                {(r.status === 'needs_review' ||
                  r.status === 'completed' ||
                  r.status === 'approved') && (
                  <Link
                    to={`/review-queue?batch=${id}&doc=${r.sourceDocumentId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('intelligence.batches.open', 'Open')}
                  </Link>
                )}
                {r.status === 'needs_review' && (
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(r.id)}
                  >
                    {t('intelligence.batches.approve', 'Approve')}
                  </Button>
                )}
                {/* Manual type override — process/redo as a chosen type. Useful
                    for archived / failed / generic / misclassified runs. */}
                {r.status !== 'running' && r.status !== 'queued' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={reprocess.isPending}
                      >
                        {t('intelligence.batches.reprocessAs', 'Process as…')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="max-h-80 overflow-y-auto"
                    >
                      <DropdownMenuLabel>
                        {t(
                          'intelligence.batches.reprocessAsLabel',
                          'Re-extract as type',
                        )}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(schemaOptions.data ?? []).map((s) => (
                        <DropdownMenuItem
                          key={s.key}
                          onSelect={() =>
                            reprocess.mutate({
                              sourceDocumentId: r.sourceDocumentId,
                              schemaKey: s.key,
                            })
                          }
                        >
                          {s.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {ARCHIVABLE.has(r.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error"
                    disabled={archive.isPending}
                    onClick={() => archive.mutate({ runId: r.id })}
                  >
                    {t('intelligence.batches.skip', 'Skip')}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {runs.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-foreground/50">
              {t('intelligence.batches.noRuns', 'No documents match this filter.')}
            </p>
          )}
        </CardContent>
      </Card>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || runsQuery.isFetching}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            {t('common.prev', 'Prev')}
          </Button>
          <span className="text-foreground/60">
            {t('search.pageOf', 'Page {{page}} of {{count}}', {
              page: page + 1,
              count: pageCount,
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= pageCount || runsQuery.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('common.next', 'Next')}
          </Button>
        </div>
      )}
    </div>
  );
}

