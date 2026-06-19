import {
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DataTable,
  type DataTableColumn,
  Spinner,
} from '@org/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { PageHeader } from '../../components/page-header';
import {
  useApproveRun,
  useBatch,
  useBatchRuns,
  useBulkRunAction,
  useExtraction,
  useReviewQueue,
} from './queries';
import { ReviewExtraction } from './ReviewExtraction';
import { ViewOriginalButton } from './ViewOriginalButton';
import { ArrowRightIcon, FileTextIcon } from './icons';

/** Unified entry the stepper walks (from the review queue OR a batch's runs). */
interface QueueEntry {
  pipelineRunId: string;
  sourceDocumentId: string;
  filename: string;
  documentTypeKey: string | null;
  status: string;
  overallConfidence?: number | null;
  updatedAt?: string;
  batchId?: string | null;
  batchName?: string | null;
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
          updatedAt: r.updatedAt,
          batchId,
          batchName: batch?.name ?? null,
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
      updatedAt: i.updatedAt,
      batchId: i.batchId,
      batchName: i.batchName,
    }));
  }, [batchId, batch?.name, batchRuns.data?.items, reviewQueue.data?.items]);

  const count = items.length;
  const pendingCount = items.filter((i) => i.status === 'needs_review').length;
  // null = list view; a number = focused review at that index.
  const [current, setCurrent] = useState<number | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const confirm = useConfirm();
  const bulkAction = useBulkRunAction(batchId);

  const types = useMemo(
    () =>
      [
        ...new Set(items.map((i) => i.documentTypeKey).filter(Boolean)),
      ] as string[],
    [items],
  );

  const statuses = useMemo(
    () => [...new Set(items.map((i) => i.status))] as string[],
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (!typeFilter || (i.documentTypeKey ?? '') === typeFilter) &&
          (!statusFilter || i.status === statusFilter),
      ),
    [items, typeFilter, statusFilter],
  );

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

  // The approvable subset of the current selection — anything still parked
  // at needs_review. Already-approved / completed rows are ignored on
  // bulk-approve so the button can stay one-click. Declared here (not next
  // to its callsite below) so the hook count stays stable across the early
  // returns that follow.
  const approvableIds = useMemo(() => {
    const byId = new Map(items.map((i) => [i.pipelineRunId, i]));
    return Array.from(selected).filter(
      (id) => byId.get(id)?.status === 'needs_review',
    );
  }, [items, selected]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[60px] animate-pulse rounded-xl bg-secondary/40"
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

  const openReview = (pipelineRunId: string) =>
    setCurrent(items.findIndex((x) => x.pipelineRunId === pipelineRunId));

  const onBulkApprove = async () => {
    if (!approvableIds.length) return;
    const ok = await confirm({
      title: t('intelligence.queue.bulkApproveTitle', 'Approve {{n}} run{{s}}?', {
        n: approvableIds.length,
        s: approvableIds.length === 1 ? '' : 's',
      }),
      description: t(
        'intelligence.queue.bulkApproveDesc',
        "We'll mark each run as approved and finalize its export. Run-level errors are tolerated; the toast shows aggregate counts.",
      ),
      confirmLabel: t('intelligence.queue.approve', 'Approve'),
    });
    if (!ok) return;
    await bulkAction.mutateAsync({
      action: 'approve',
      runIds: approvableIds,
    });
    setSelected(new Set());
  };

  const onBulkArchive = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const ok = await confirm({
      title: t('intelligence.queue.bulkArchiveTitle', 'Skip {{n}} run{{s}}?', {
        n: ids.length,
        s: ids.length === 1 ? '' : 's',
      }),
      description: t(
        'intelligence.queue.bulkArchiveDesc',
        "Archived runs are skipped — no further extraction or export. You can still see them in the batch's archived bucket.",
      ),
      confirmLabel: t('intelligence.queue.archive', 'Archive'),
      variant: 'destructive',
    });
    if (!ok) return;
    await bulkAction.mutateAsync({
      action: 'archive',
      runIds: ids,
      reason: 'Bulk skipped from review queue',
    });
    setSelected(new Set());
  };

  const columns: DataTableColumn<QueueEntry>[] = [
    {
      key: 'file',
      header: t('intelligence.queue.file', 'File'),
      sortValue: (r) => r.filename.toLowerCase(),
      cell: (r) => (
        <button
          type="button"
          onClick={() => openReview(r.pipelineRunId)}
          className="group flex min-w-0 items-center gap-2.5 text-left"
        >
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-lg bg-secondary/60 text-foreground/70 group-hover:text-primary">
            <FileTextIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground group-hover:text-primary">
              {r.filename}
            </span>
            <span className="block text-xs text-foreground/45">
              {r.documentTypeKey ??
                t('intelligence.queue.unknownType', 'Unknown type')}
            </span>
          </span>
        </button>
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
          <span className="text-foreground/45">
            {t('intelligence.queue.unknownType', 'Unknown type')}
          </span>
        ),
    },
    ...(!batchId
      ? [
          {
            key: 'batch',
            header: t('intelligence.queue.batch', 'Batch'),
            sortValue: (r: QueueEntry) => (r.batchName ?? '').toLowerCase(),
            cell: (r: QueueEntry) =>
              r.batchId ? (
                <Link
                  to={`/batches/${r.batchId}`}
                  className="truncate text-foreground/75 hover:text-primary hover:underline"
                >
                  {r.batchName ??
                    t('intelligence.queue.untitledBatch', 'Untitled batch')}
                </Link>
              ) : (
                <span className="text-foreground/40">—</span>
              ),
          },
        ]
      : []),
    {
      key: 'status',
      header: t('common.status', 'Status'),
      width: 'w-32',
      sortValue: (r: QueueEntry) => r.status,
      cell: (r: QueueEntry) => (
        <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'} outline>
          {r.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'confidence',
      header: t('intelligence.queue.confidence', 'Confidence'),
      align: 'center',
      width: 'w-28',
      sortValue: (r) => r.overallConfidence ?? -1,
      cell: (r) => {
        const pct =
          r.overallConfidence != null
            ? Math.round(r.overallConfidence * 100)
            : null;
        return pct != null ? (
          <Badge variant={pct >= 85 ? 'success' : 'warning'} outline>
            {pct}%
          </Badge>
        ) : (
          <span className="text-foreground/40">—</span>
        );
      },
    },
    {
      key: 'updated',
      header: t('common.updated', 'Updated'),
      width: 'w-32',
      sortValue: (r) => r.updatedAt ?? '',
      cell: (r) =>
        r.updatedAt ? (
          <span className="text-foreground/55">
            {new Date(r.updatedAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-foreground/40">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-28',
      cell: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => openReview(r.pipelineRunId)}
          className="gap-1.5"
        >
          {t('intelligence.queue.review', 'Review')}
          <ArrowRightIcon className="size-3.5" />
        </Button>
      ),
    },
  ];

  // ─── List view ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        back={!!batchId}
        backTo={batchId ? `/batches/${batchId}` : undefined}
        title={t('intelligence.queue.title', 'Review queue')}
        subtitle={
          <>
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
          </>
        }
        actions={
          pendingCount > 0 ? (
            <Button size="sm" onClick={() => setCurrent(0)} className="gap-1.5">
              {batchId
                ? t('intelligence.queue.reviewBatch', 'Review batch')
                : t('intelligence.queue.reviewAll', 'Review all')}
              <ArrowRightIcon className="size-3.5" />
            </Button>
          ) : undefined
        }
      />

      <DataTable
        tableId={
          batchId
            ? 'intelligence.reviewQueue.batch'
            : 'intelligence.reviewQueue.global'
        }
        data={filtered}
        columns={columns}
        rowKey={(r) => r.pipelineRunId}
        search={(r) =>
          `${r.filename} ${r.documentTypeKey ?? ''} ${r.batchName ?? ''}`
        }
        searchPlaceholder={t(
          'intelligence.queue.search',
          'Search by file, type, or batch…',
        )}
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        initialSort={{ key: 'updated', dir: 'desc' }}
        empty={t('intelligence.queue.empty', 'Nothing to review here.')}
        selection={{ selectedIds: selected, onChange: setSelected }}
        selectionLabel={(n) =>
          approvableIds.length !== n
            ? `${t('intelligence.queue.nSelected', '{{n}} selected', { n })} · ${t('intelligence.queue.nApprovable', '{{n}} can be approved', { n: approvableIds.length })}`
            : t('intelligence.queue.nSelected', '{{n}} selected', { n })
        }
        bulkActions={() => (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkAction.isPending}
              onClick={onBulkArchive}
            >
              {bulkAction.isPending && bulkAction.variables?.action === 'archive'
                ? t('common.archiving', 'Archiving…')
                : t('intelligence.queue.archiveN', 'Archive {{n}}', {
                    n: selected.size,
                  })}
            </Button>
            <Button
              size="sm"
              disabled={approvableIds.length === 0 || bulkAction.isPending}
              onClick={onBulkApprove}
            >
              {bulkAction.isPending && bulkAction.variables?.action === 'approve'
                ? t('common.approving', 'Approving…')
                : t('intelligence.queue.approveN', 'Approve {{n}}', {
                    n: approvableIds.length,
                  })}
            </Button>
          </>
        )}
        toolbar={
          (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
              {batchId && statuses.length > 1 && (
                <Select
                  value={statusFilter ?? '__any__'}
                  onValueChange={(v) =>
                    setStatusFilter(v === '__any__' ? null : v)
                  }
                >
                  <SelectTrigger className="h-9 w-44 text-sm">
                    <SelectValue
                      placeholder={t(
                        'intelligence.queue.filter.allStatuses',
                        'All statuses',
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">
                      {t(
                        'intelligence.queue.filter.allStatuses',
                        'All statuses',
                      )}
                    </SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {types.length > 1 && (
                <Select
                  value={typeFilter ?? '__any__'}
                  onValueChange={(v) =>
                    setTypeFilter(v === '__any__' ? null : v)
                  }
                >
                  <SelectTrigger className="h-9 w-48 text-sm">
                    <SelectValue
                      placeholder={t(
                        'intelligence.queue.filter.allTypes',
                        'All types',
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">
                      {t(
                        'intelligence.queue.filter.allTypes',
                        'All types',
                      )}
                    </SelectItem>
                    {types.map((ty) => (
                      <SelectItem key={ty} value={ty}>
                        {ty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              </div>
            </div>
          )
        }
      />
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
    <div className="mx-auto space-y-4">
      {/* Stepper header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="gap-1.5"
          >
            <ArrowRightIcon className="size-3.5 rotate-180" />
            {t('intelligence.queue.backToList', 'Back to list')}
          </Button>
          <span className="text-sm tabular-nums text-foreground/60">
            {t('intelligence.queue.progress', '{{n}} of {{total}}', {
              n: index + 1,
              total: count,
            })}
          </span>
          <Badge variant={STATUS_VARIANT[entry.status] ?? 'secondary'} outline>
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
