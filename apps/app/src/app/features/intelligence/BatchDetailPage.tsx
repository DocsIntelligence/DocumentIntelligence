import {
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  DataTable,
  type DataTableColumn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
} from '@org/ui';
import type { BatchRun } from '@org/api-client';
import { useState, type ReactNode } from 'react';
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
import { FileTextIcon, InboxIcon } from './icons';
import { AiUsageSummary } from '../admin/ai-usage/AiUsageSummary';

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

  const skipOne = async (runId: string) => {
    const ok = await confirm({
      title: t('intelligence.batches.skipOneTitle', 'Skip this document?'),
      description: t(
        'intelligence.batches.skipTypeDesc',
        'They will be archived (not extracted). This cannot be undone.',
      ),
      confirmLabel: t('intelligence.batches.skip', 'Skip'),
      variant: 'destructive',
    });
    if (ok) archive.mutate({ runId });
  };

  if (isLoading || !batch) {
    return (
      <div className="mx-auto py-12 text-center">
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
    if (ok)
      bulk.mutate({
        documentTypeKey,
        reason: `Skipped type ${documentTypeKey}`,
      });
  };

  const maxCount = Math.max(1, ...typeHistogram.map((h) => h.count));

  return (
    <div className="mx-auto space-y-5">
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
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${s.bar}`}
                />
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

      {/* AI usage attributed to this batch */}
      {id && <AiUsageSummary scope={{ kind: 'batch', id }} />}

      {/* Runs table — search + sort + paginated, server-driven */}
      {(() => {
        const columns: DataTableColumn<BatchRun>[] = [
          {
            key: 'file',
            header: t('intelligence.queue.file', 'File'),
            sortValue: (r) => r.filename.toLowerCase(),
            cell: (r) => (
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex size-8 flex-none items-center justify-center rounded-lg bg-secondary/60 text-foreground/70">
                  <FileTextIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.filename}
                  </p>
                  <p className="truncate text-xs text-foreground/45">
                    {r.documentTypeKey ??
                      t('intelligence.batches.unclassified', 'unclassified')}
                    {r.status === 'archived' && r.archivedReason
                      ? ` · ${r.archivedReason}`
                      : ''}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: 'type',
            header: t('intelligence.queue.type', 'Type'),
            sortValue: (r) => r.documentTypeKey ?? '',
            cell: (r) =>
              r.documentTypeKey ? (
                <Badge variant="secondary" outline>
                  {r.documentTypeKey}
                </Badge>
              ) : (
                <span className="text-foreground/40">—</span>
              ),
          },
          {
            key: 'status',
            header: t('common.status', 'Status'),
            width: 'w-32',
            sortValue: (r) => r.status,
            cell: (r) => (
              <Badge variant={RUN_VARIANT[r.status] ?? 'secondary'}>
                {r.status.replace(/_/g, ' ')}
              </Badge>
            ),
          },
          {
            key: 'updated',
            header: t('common.updated', 'Updated'),
            width: 'w-32',
            sortValue: (r) => r.updatedAt,
            cell: (r) => (
              <span className="text-foreground/55">
                {new Date(r.updatedAt).toLocaleDateString()}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            width: 'w-[180px]',
            pinned: true,
            cell: (r) => {
              const openable =
                r.status === 'needs_review' ||
                r.status === 'completed' ||
                r.status === 'approved';
              const canReprocess =
                r.status !== 'running' && r.status !== 'queued';
              const canSkip = ARCHIVABLE.has(r.status);
              return (
                <div className="flex items-center justify-end gap-0.5">
                  {/* Primary inline icons */}
                  {openable && (
                    <IconLink
                      to={`/review-queue?batch=${id}&doc=${r.sourceDocumentId}`}
                      title={t('intelligence.batches.open', 'Open')}
                    >
                      <OpenIcon />
                    </IconLink>
                  )}
                  {r.status === 'needs_review' && (
                    <IconButton
                      title={t('intelligence.batches.approve', 'Approve')}
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(r.id)}
                    >
                      <CheckIcon />
                    </IconButton>
                  )}
                  {/* Overflow: everything else in a ⋯ dropdown */}
                  {(canReprocess || canSkip) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={t('common.actions', 'Actions')}
                          className="rounded p-1.5 text-foreground/55 transition hover:bg-secondary hover:text-foreground"
                        >
                          ⋯
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="max-h-80 overflow-y-auto"
                      >
                        {canReprocess && (
                          <>
                            <DropdownMenuLabel>
                              {t(
                                'intelligence.batches.reprocessAsLabel',
                                'Re-extract as type',
                              )}
                            </DropdownMenuLabel>
                            {(schemaOptions.data ?? []).map((s) => (
                              <DropdownMenuItem
                                key={s.key}
                                disabled={reprocess.isPending}
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
                            {canSkip && <DropdownMenuSeparator />}
                          </>
                        )}
                        {canSkip && (
                          <DropdownMenuItem
                            className="text-error"
                            disabled={archive.isPending}
                            onSelect={() => skipOne(r.id)}
                          >
                            {t('intelligence.batches.skip', 'Skip document')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            },
          },
        ];

        return (
          <DataTable
            tableId="intelligence.batchDetail.runs"
            data={runs}
            columns={columns}
            rowKey={(r) => r.id}
            search={(r) => `${r.filename} ${r.documentTypeKey ?? ''}`}
            searchPlaceholder={t(
              'intelligence.batches.searchRuns',
              'Search documents in this batch…',
            )}
            pageSizeOptions={[10, 25, 50, 100]}
            server={{
              page,
              pageCount,
              total: runsTotal,
              onPageChange: setPage,
              pageSize: RUNS_PAGE_SIZE,
              loading: runsQuery.isFetching && runsQuery.isPlaceholderData,
            }}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Chip active={!statusFilter} onClick={() => filterBy(null)}>
                  {t('common.all', 'All')} ({batch.total})
                </Chip>
                {RUN_STATUSES.map((status) => (
                  <Chip
                    key={status}
                    active={statusFilter === status}
                    onClick={() =>
                      filterBy(statusFilter === status ? null : status)
                    }
                  >
                    {status.replace(/_/g, ' ')}
                  </Chip>
                ))}
              </div>
            }
            empty={t(
              'intelligence.batches.noRuns',
              'No documents match this filter.',
            )}
          />
        );
      })()}
    </div>
  );
}

function IconButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1.5 text-foreground/60 transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function IconLink({
  to,
  title,
  children,
}: {
  to: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      title={title}
      aria-label={title}
      className="rounded p-1.5 text-foreground/60 transition hover:bg-secondary hover:text-foreground"
    >
      {children}
    </Link>
  );
}

function OpenIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="size-4 text-success"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
