import {
  Button,
  Card,
  Chip,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@org/ui';
import { cn } from '@org/utils';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import {
  useDeleteDocument,
  useDocumentCatalog,
  useDocumentsPage,
  useDuplicateDocument,
  useRenameDocument,
} from './queries';
import { useDocumentsAnalysisStatus } from '../intelligence/queries';
import { documentHref } from './document-href';
import { AnalyzeDocumentDialog } from './AnalyzeDocumentDialog';
import { BulkAnalyzeDialog, type BulkAnalyzeTarget } from './BulkAnalyzeDialog';
import { ShareDialog } from './ShareDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { AddDocToGroupDialog } from '../groups/AddToGroupDialog';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];
// DocumentStatus enum values (prisma) — a stable facet source independent of
// the current page (server-side filtering means the page only holds one page).
const STATUSES = ['draft', 'in_review', 'ready', 'signed', 'archived'] as const;

export interface DocumentsListProps {
  /** When set, scopes the list to a single group. */
  groupId?: string;
  /** When set, renders checkboxes instead of actions. Call onSelectionConfirm to get selected IDs. */
  selectable?: boolean;
  /** Called when the user confirms selection (selectable mode only). */
  onSelectionConfirm?: (documentIds: string[]) => void;
  /** IDs to exclude from the list (already in group, etc). */
  excludeIds?: string[];
}

export function DocumentsList({
  groupId,
  selectable,
  onSelectionConfirm,
  excludeIds,
}: DocumentsListProps = {}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const del = useDeleteDocument();
  const duplicate = useDuplicateDocument();
  const rename = useRenameDocument();

  // Server-driven list state: page, sort, search, and the status/type facets
  // are ALL resolved by the backend (the table only ever holds one page).
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    { key: 'updated', dir: 'desc' },
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Any filter/search/sort/page-size change resets to the first page.
  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, typeFilter, sort, pageSize]);

  const { data, isLoading, isFetching, isPlaceholderData, error } =
    useDocumentsPage({
      page,
      pageSize,
      q: query.trim() || undefined,
      sort: (sort?.key as never) ?? undefined,
      dir: sort?.dir ?? undefined,
      status: (statusFilter as never) ?? undefined,
      documentTypeKey: typeFilter ?? undefined,
      groupId,
    });
  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(query.trim() || statusFilter || typeFilter);

  // Type facets come from the full catalog (stable, page-independent).
  const { data: catalog } = useDocumentCatalog();
  const types = useMemo(
    () =>
      (catalog ?? [])
        .map((c) => [c.key, c.name] as const)
        .sort((a, b) => a[1].localeCompare(b[1])),
    [catalog],
  );

  // Dialog targets (keyed by doc id so one dialog instance serves every card).
  const [shareId, setShareId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [addToGroupId, setAddToGroupId] = useState<string | null>(null);
  const [analyzeDoc, setAnalyzeDoc] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [bulkAnalyzeOpen, setBulkAnalyzeOpen] = useState(false);
  const [renameDoc, setRenameDoc] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Internal multi-select mode for bulk analyze. Independent of the external
  // `selectable` prop (which is used by the group add-docs flow).
  const [internalSelect, setInternalSelect] = useState(false);
  const inSelectMode = selectable || internalSelect;

  // Selection state (used by both external selectable mode AND internal select mode)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Per-page analysis-status batch lookup (one round-trip per page).
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const analysisStatus = useDocumentsAnalysisStatus(pageIds);

  // Filter out excluded IDs
  const filteredRows = useMemo(
    () =>
      excludeIds?.length
        ? rows.filter((r) => !excludeIds.includes(r.id))
        : rows,
    [rows, excludeIds],
  );

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    // Selection checkbox column (any select mode — external prop OR internal toggle)
    ...(inSelectMode
      ? [
          {
            key: 'select',
            header: '',
            width: 'w-10',
            pinned: true,
            cell: (d: (typeof rows)[number]) => (
              <button
                type="button"
                onClick={() => toggleSelect(d.id)}
                className={`flex size-4 shrink-0 items-center justify-center rounded border transition ${
                  selected.has(d.id)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {selected.has(d.id) && (
                  <svg
                    className="size-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M2.5 6.5L5 9l4.5-6" />
                  </svg>
                )}
              </button>
            ),
          } as DataTableColumn<(typeof rows)[number]>,
        ]
      : []),
    {
      key: 'title',
      header: t('documents.colTitle', 'Title'),
      sortValue: (d) => (d.title ?? '').toLowerCase(),
      cell: (d) =>
        inSelectMode ? (
          <button
            type="button"
            onClick={() => toggleSelect(d.id)}
            className="group block min-w-0 text-left"
          >
            <span className="block truncate font-medium text-foreground group-hover:text-primary">
              {d.title || t('common.untitled', 'Untitled')}
            </span>
            <span className="block truncate text-xs text-foreground/50">
              {d.template?.name ?? '—'} · {d.pageSize.replace(/_/g, ' ')}
            </span>
          </button>
        ) : (
          <Link to={documentHref(d)} className="group block min-w-0">
            <span className="block truncate font-medium text-foreground group-hover:text-primary">
              {d.title || t('common.untitled', 'Untitled')}
            </span>
            <span className="block truncate text-xs text-foreground/50">
              {d.template?.name ?? '—'} · {d.pageSize.replace(/_/g, ' ')}
            </span>
          </Link>
        ),
    },
    {
      key: 'type',
      header: t('documents.colType', 'Type'),
      sortValue: (d) => d.documentType?.name ?? '',
      cell: (d) => (
        <span className="text-foreground/70">
          {d.documentType?.name ?? t('common.document', 'Document')}
        </span>
      ),
    },
    // Group column — shown when NOT already inside a group and NOT in select mode
    ...(!groupId && !inSelectMode
      ? [
          {
            key: 'group',
            header: t('documents.colGroup', 'Group'),
            sortValue: (d: (typeof rows)[number]) => d.group?.name ?? '',
            cell: (d: (typeof rows)[number]) =>
              d.group ? (
                <Link
                  to={`/groups/${d.group.id}`}
                  className="text-xs text-primary hover:underline truncate block"
                >
                  {d.group.kind === 'bundle'
                    ? '📦'
                    : d.group.kind === 'matter'
                      ? '⚖️'
                      : '📁'}{' '}
                  {d.group.name}
                </Link>
              ) : (
                <span className="text-xs text-foreground/30">—</span>
              ),
          } as DataTableColumn<(typeof rows)[number]>,
        ]
      : []),
    {
      key: 'status',
      header: t('documents.colStatus', 'Status'),
      sortValue: (d) => d.status,
      cell: (d) => <StatusPill status={d.status} />,
    },
    // Analysis status column — page-batched lookup, click to open the dialog.
    ...(!selectable
      ? [
          {
            key: 'analysis',
            header: t('documents.colAnalysis', 'Analysis'),
            cell: (d: (typeof rows)[number]) => (
              <AnalysisCell
                status={analysisStatus.data?.[d.id]}
                loading={analysisStatus.isLoading}
                onClick={
                  inSelectMode
                    ? undefined
                    : () =>
                        setAnalyzeDoc({
                          id: d.id,
                          title: d.title ?? '',
                        })
                }
              />
            ),
          } as DataTableColumn<(typeof rows)[number]>,
        ]
      : []),
    {
      key: 'updated',
      header: t('common.updated', 'Updated'),
      align: 'right',
      sortValue: (d) => d.updatedAt,
      cell: (d) => (
        <span className="text-foreground/55">
          {new Date(d.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    // Actions column — hidden in any select mode
    ...(!inSelectMode
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            width: 'w-44',
            pinned: true,
            cell: (d: (typeof rows)[number]) => (
              <div className="flex items-center justify-end gap-0.5">
                <IconButton
                  title={t('common.open', 'Open')}
                  onClick={() => navigate(documentHref(d))}
                >
                  <EditGlyph />
                </IconButton>
                <IconButton
                  title={t('documents.duplicate', 'Duplicate')}
                  onClick={() => duplicate.mutate(d.id)}
                >
                  <CopyGlyph />
                </IconButton>
                <IconButton
                  danger
                  title={t('common.delete', 'Delete')}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('documents.deleteTitle', 'Delete document?'),
                      description: t(
                        'documents.deleteDesc',
                        'This permanently deletes the document. This cannot be undone.',
                      ),
                      confirmLabel: t('common.delete', 'Delete'),
                      variant: 'destructive',
                    });
                    if (ok) del.mutate(d.id);
                  }}
                >
                  <TrashGlyph />
                </IconButton>
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
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() =>
                        setRenameDoc({ id: d.id, title: d.title ?? '' })
                      }
                    >
                      {t('common.rename', 'Rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShareId(d.id)}>
                      {t('documents.share', 'Share')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setHistoryId(d.id)}>
                      {t('documents.history', 'Version history')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setAddToGroupId(d.id)}>
                      {t('documents.addToGroup', 'Add to group')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        setAnalyzeDoc({ id: d.id, title: d.title ?? '' })
                      }
                    >
                      {analysisStatus.data?.[d.id]?.hasAnalysis
                        ? t('documents.viewOrReanalyze', 'View / re-analyze')
                        : t('documents.analyze.run', 'Analyze')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          } as DataTableColumn<(typeof rows)[number]>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {!groupId && !selectable && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('documents.title', 'My documents')}
            </h1>
            <p className="mt-1 text-foreground/60">
              {t(
                'documents.subtitle',
                'Drafts, signed copies, and shared documents.',
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={internalSelect ? 'default' : 'outline'}
              onClick={() => {
                setInternalSelect((v) => !v);
                setSelected(new Set());
              }}
            >
              {internalSelect
                ? t('common.cancelSelection', 'Cancel selection')
                : t('documents.selectToAnalyze', 'Select to analyze')}
            </Button>
            <Button asChild>
              <Link to="/documents/new">
                {t('common.newDocument', 'New document')}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Selection bar */}
      {inSelectMode && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} document{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              {t('common.clearSelection', 'Clear')}
            </Button>
            {selectable ? (
              <Button
                size="sm"
                onClick={() => onSelectionConfirm?.(Array.from(selected))}
              >
                {t(
                  'groups.addSelected',
                  `Add ${selected.size} document${selected.size !== 1 ? 's' : ''}`,
                )}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setBulkAnalyzeOpen(true)}>
                {t(
                  'documents.analyzeSelected',
                  `Analyze ${selected.size} document${selected.size !== 1 ? 's' : ''}`,
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-secondary/40"
            />
          ))}
        </div>
      )}

      {error && (
        <Card className="rounded-xl p-6">
          <p className="text-sm text-error">
            {t(
              'documents.loadError',
              'Could not load documents. Please try again.',
            )}
          </p>
        </Card>
      )}

      {!isLoading && !error && total === 0 && !hasFilters && (
        <Card className="rounded-xl border-dashed p-10 text-center">
          <p className="text-foreground/70">
            {t('dashboard.emptyTitle', 'No documents yet.')}
          </p>
          <p className="mt-1 text-sm text-foreground/50">
            {t(
              'documents.emptyDesc',
              'Start with a rent agreement, an RTI, a legal notice — or draft one with AI.',
            )}
          </p>
          <Button asChild className="mt-4">
            <Link to="/documents/new">
              {t('dashboard.createFirst', 'Create your first document')}
            </Link>
          </Button>
        </Card>
      )}

      {!isLoading && !error && (total > 0 || hasFilters) && (
        <DataTable
          tableId={groupId ? `documents.group.${groupId}` : 'documents.list'}
          data={filteredRows}
          columns={columns}
          rowKey={(d) => d.id}
          search={(d) => d.title ?? ''}
          searchPlaceholder={t('documents.search', 'Search by title…')}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          server={{
            page,
            pageCount,
            total,
            onPageChange: setPage,
            sort,
            onSortChange: setSort,
            query,
            onQueryChange: setQuery,
            pageSize,
            onPageSizeChange: setPageSize,
            loading: isFetching && isPlaceholderData,
          }}
          toolbar={
            !groupId ? (
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  active={!statusFilter}
                  onClick={() => setStatusFilter(null)}
                >
                  {t('common.all', 'All')}
                </Chip>
                {STATUSES.map((s) => (
                  <Chip
                    key={s}
                    active={statusFilter === s}
                    onClick={() =>
                      setStatusFilter(statusFilter === s ? null : s)
                    }
                  >
                    {t(`status.${s}`, s.replace(/_/g, ' '))}
                  </Chip>
                ))}
                {types.length > 1 && (
                  <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                )}
                {types.length > 1 &&
                  types.map(([key, name]) => (
                    <Chip
                      key={key}
                      active={typeFilter === key}
                      onClick={() =>
                        setTypeFilter(typeFilter === key ? null : key)
                      }
                    >
                      {name}
                    </Chip>
                  ))}
              </div>
            ) : undefined
          }
          empty={t('documents.noMatch', 'No documents match these filters.')}
        />
      )}

      {shareId && (
        <ShareDialog
          documentId={shareId}
          open={!!shareId}
          onOpenChange={(v) => !v && setShareId(null)}
        />
      )}
      {historyId && (
        <VersionHistoryDialog
          documentId={historyId}
          open={!!historyId}
          onOpenChange={(v) => !v && setHistoryId(null)}
        />
      )}
      <RenameDialog
        target={renameDoc}
        onClose={() => setRenameDoc(null)}
        onSave={(title) => {
          if (renameDoc) rename.mutate({ id: renameDoc.id, title });
          setRenameDoc(null);
        }}
        saving={rename.isPending}
      />
      {addToGroupId && (
        <AddDocToGroupDialog
          documentIds={[addToGroupId]}
          open={!!addToGroupId}
          onOpenChange={(v) => !v && setAddToGroupId(null)}
        />
      )}
      {analyzeDoc && (
        <AnalyzeDocumentDialog
          documentId={analyzeDoc.id}
          title={analyzeDoc.title}
          open={!!analyzeDoc}
          onOpenChange={(v) => !v && setAnalyzeDoc(null)}
        />
      )}
      {bulkAnalyzeOpen && (
        <BulkAnalyzeDialog
          targets={(filteredRows
            .filter((r) => selected.has(r.id))
            .map((r) => ({ id: r.id, title: r.title ?? '' })) as BulkAnalyzeTarget[])}
          open={bulkAnalyzeOpen}
          onOpenChange={setBulkAnalyzeOpen}
          onComplete={() => {
            // Refresh the page-level status badges.
            // (queries.ts invalidation handles cache.)
          }}
        />
      )}
    </div>
  );
}

function RenameDialog({
  target,
  onClose,
  onSave,
  saving,
}: {
  target: { id: string; title: string } | null;
  onClose: () => void;
  onSave: (title: string) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const open = !!target;
  // Seed the input whenever a new target opens.
  useEffect(() => {
    if (target) setValue(target.title);
  }, [target]);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('documents.renameTitle', 'Rename document')}
          </DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('common.untitled', 'Untitled')}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={!value.trim() || saving}
            onClick={() => onSave(value.trim())}
          >
            {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IconButton({
  title,
  danger,
  disabled,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
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
      className={cn(
        'rounded p-1.5 transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'text-error hover:text-error'
          : 'text-foreground/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function EditGlyph() {
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
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function CopyGlyph() {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashGlyph() {
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
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}

function relativeShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function AnalysisCell({
  status,
  loading,
  onClick,
}: {
  status:
    | { hasAnalysis: boolean; lastAnalyzedAt: string | null }
    | undefined;
  loading: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  if (loading && !status) {
    return (
      <span className="inline-block h-4 w-16 animate-pulse rounded bg-secondary/50" />
    );
  }
  if (!status?.hasAnalysis) {
    const inner = (
      <span className="text-[11px] text-foreground/40">
        {t('documents.notAnalyzed', 'Not analyzed')}
      </span>
    );
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        className="rounded px-1.5 py-0.5 hover:bg-secondary"
        title={t('documents.analyze.run', 'Analyze')}
      >
        {inner}
      </button>
    ) : (
      inner
    );
  }
  const label = `✓ ${relativeShort(status.lastAnalyzedAt)}`;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success-foreground hover:bg-success/15"
      title={t('documents.viewOrReanalyze', 'View / re-analyze')}
    >
      {label}
    </button>
  ) : (
    <span className="rounded bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success-foreground">
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    in_review: 'bg-blue-100 text-blue-800',
    ready: 'bg-emerald-100 text-emerald-800',
    signed: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-foreground/10 text-foreground/60',
  };
  return (
    <span
      className={cn(
        'flex-none rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone[status] ?? 'bg-foreground/10 text-foreground/60',
      )}
    >
      {t(`status.${status}`, status.replace(/_/g, ' '))}
    </span>
  );
}
