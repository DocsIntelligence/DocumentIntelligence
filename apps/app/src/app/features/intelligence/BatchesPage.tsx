import type { BatchSummary } from '@org/api-client';
import {
  Badge,
  Button,
  Chip,
  DataTable,
  type DataTableColumn,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useBatches } from './queries';
import {
  AlertIcon,
  ArchiveIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxIcon,
  LayersIcon,
  UploadIcon,
} from './icons';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  completed: 'success',
  needs_review: 'warning',
  failed: 'error',
  running: 'info',
};

/**
 * Batches list (docs/07 P4.3): KPI tiles across all batches + a searchable,
 * sortable, paginated table. Uploading a new batch lives on its own page
 * (/batches/new). Each row links to the batch detail and (when flagged) into
 * the scoped review queue; expanding a row reveals its progress breakdown.
 */
export function BatchesPage() {
  const { t } = useTranslation();
  const { data: batches } = useBatches();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const totals = useMemo(() => {
    const list = batches ?? [];
    return list.reduce(
      (a, b) => ({
        running: a.running + b.running,
        needsReview: a.needsReview + b.needsReview,
        completed: a.completed + b.completed,
        archived: a.archived + b.archived,
        failed: a.failed + b.failed,
      }),
      { running: 0, needsReview: 0, completed: 0, archived: 0, failed: 0 },
    );
  }, [batches]);

  const statuses = useMemo(
    () => [...new Set((batches ?? []).map((b) => b.status))].sort(),
    [batches],
  );
  const rows = useMemo(
    () =>
      (batches ?? []).filter((b) => !statusFilter || b.status === statusFilter),
    [batches, statusFilter],
  );
  const hasBatches = (batches ?? []).length > 0;

  const columns: DataTableColumn<BatchSummary>[] = [
    {
      key: 'name',
      header: t('intelligence.batches.colName', 'Batch'),
      sortValue: (b) => (b.name ?? b.id).toLowerCase(),
      cell: (b) => (
        <Link
          to={`/batches/${b.id}`}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-lg bg-secondary/60 text-foreground/70 group-hover:text-primary">
            <LayersIcon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground group-hover:text-primary">
              {b.name ?? t('intelligence.batches.untitled', 'Untitled batch')}
            </span>
            <span className="block text-xs text-foreground/45">
              {new Date(b.createdAt).toLocaleDateString()}
            </span>
          </span>
        </Link>
      ),
    },
    {
      key: 'status',
      header: t('intelligence.batches.colStatus', 'Status'),
      sortValue: (b) => b.status,
      cell: (b) => (
        <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>
          {b.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'docs',
      header: t('intelligence.batches.colDocs', 'Docs'),
      align: 'right',
      sortValue: (b) => b.total,
      cell: (b) => <span className="tabular-nums">{b.total}</span>,
    },
    {
      key: 'done',
      header: t('intelligence.funnel.completed', 'Done'),
      align: 'right',
      sortValue: (b) => (b.total ? b.completed / b.total : 0),
      cell: (b) => (
        <span className="tabular-nums text-foreground/70">
          {b.completed}/{b.total}
        </span>
      ),
    },
    {
      key: 'created',
      header: t('common.created', 'Created'),
      sortValue: (b) => b.createdAt,
      cell: (b) => (
        <span className="text-foreground/55">
          {new Date(b.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (b) =>
        b.needsReview > 0 ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/review-queue?batch=${b.id}`} className="gap-1.5">
              <InboxIcon className="size-3.5" />
              {t('intelligence.batches.reviewN', 'Review {{n}}', {
                n: b.needsReview,
              })}
            </Link>
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('intelligence.batches.title', 'Batches')}
          </h1>
          <p className="mt-1 text-foreground/60">
            {t(
              'intelligence.batches.subtitle',
              'Upload many documents at once — they’re classified, extracted, and queued for review automatically.',
            )}
          </p>
        </div>
        <Button asChild>
          <Link to="/batches/new" className="gap-1.5">
            <UploadIcon className="size-4" />
            {t('intelligence.batches.new', 'New batch')}
          </Link>
        </Button>
      </div>

      {/* KPI tiles */}
      {hasBatches && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            tone="info"
            icon={<ClockIcon className="size-5" />}
            value={totals.running}
            label={t('intelligence.funnel.inProgress', 'In progress')}
          />
          <StatTile
            tone="warning"
            icon={<InboxIcon className="size-5" />}
            value={totals.needsReview}
            label={t('intelligence.funnel.needsReview', 'To review')}
          />
          <StatTile
            tone="success"
            icon={<CheckCircleIcon className="size-5" />}
            value={totals.completed}
            label={t('intelligence.funnel.completed', 'Completed')}
          />
          <StatTile
            tone="muted"
            icon={<ArchiveIcon className="size-5" />}
            value={totals.archived}
            label={t('intelligence.funnel.archived', 'Archived')}
          />
          <StatTile
            tone="error"
            icon={<AlertIcon className="size-5" />}
            value={totals.failed}
            label={t('intelligence.funnel.failed', 'Failed')}
          />
        </div>
      )}

      {hasBatches ? (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(b) => b.id}
          search={(b) => `${b.name ?? ''} ${b.id}`}
          searchPlaceholder={t('intelligence.batches.search', 'Search batches…')}
          initialSort={{ key: 'created', dir: 'desc' }}
          renderExpanded={(b) => <BatchBreakdown batch={b} />}
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              <Chip active={!statusFilter} onClick={() => setStatusFilter(null)}>
                {t('common.all', 'All')}
              </Chip>
              {statuses.map((s) => (
                <Chip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                >
                  {s.replace(/_/g, ' ')}
                </Chip>
              ))}
            </div>
          }
          empty={t('intelligence.batches.noMatch', 'No batches match these filters.')}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-foreground/70">
            {t('intelligence.batches.empty', 'No batches yet.')}
          </p>
          <p className="mt-1 text-sm text-foreground/50">
            {t(
              'intelligence.batches.emptyHint',
              'Upload a set of documents above to run your first batch.',
            )}
          </p>
          <Button asChild className="mt-4">
            <Link to="/batches/new" className="gap-1.5">
              <UploadIcon className="size-4" />
              {t('intelligence.batches.new', 'New batch')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

const TONE: Record<string, string> = {
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
  success: 'bg-success/15 text-success',
  error: 'bg-error/15 text-error',
  muted: 'bg-foreground/10 text-foreground/55',
};

function StatTile({
  tone,
  icon,
  value,
  label,
}: {
  tone: keyof typeof TONE | string;
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <span
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg',
          TONE[tone] ?? TONE.muted,
        )}
      >
        {icon}
      </span>
      <p className="mt-3 text-2xl font-semibold leading-none tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-foreground/55">{label}</p>
    </div>
  );
}

/** Expanded-row content: the segmented progress bar + per-status counts. */
function BatchBreakdown({ batch: b }: { batch: BatchSummary }) {
  const { t } = useTranslation();
  const total = Math.max(1, b.total);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-3">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <span className="bg-success" style={{ width: seg(b.completed) }} />
        <span className="bg-warning" style={{ width: seg(b.needsReview) }} />
        <span className="bg-info" style={{ width: seg(b.running) }} />
        <span className="bg-foreground/30" style={{ width: seg(b.archived) }} />
        <span className="bg-error" style={{ width: seg(b.failed) }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/55">
        <Count icon={<CheckCircleIcon className="size-3.5 text-success" />}>
          {b.completed}/{b.total} {t('intelligence.funnel.completed', 'done')}
        </Count>
        {b.running > 0 && (
          <Count icon={<ClockIcon className="size-3.5 text-info" />}>
            {b.running} {t('intelligence.batches.inFlight', 'in progress')}
          </Count>
        )}
        {b.needsReview > 0 && (
          <Count icon={<InboxIcon className="size-3.5 text-warning" />}>
            {b.needsReview} {t('intelligence.funnel.needsReview', 'to review')}
          </Count>
        )}
        {b.archived > 0 && (
          <Count icon={<ArchiveIcon className="size-3.5" />}>
            {b.archived} {t('intelligence.funnel.archived', 'archived')}
          </Count>
        )}
        {b.failed > 0 && (
          <Count icon={<AlertIcon className="size-3.5 text-error" />}>
            {b.failed} {t('intelligence.funnel.failed', 'failed')}
          </Count>
        )}
      </div>
    </div>
  );
}

function Count({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {icon}
      {children}
    </span>
  );
}
