import {
  Button,
  Card,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { PageHeader } from '../../components/page-header';
import {
  useDeleteDocument,
  useDocumentCatalog,
  useDocumentsPage,
  useDuplicateDocument,
  useRenameDocument,
} from './queries';
import { useDocumentsAnalysisStatus } from '../intelligence/queries';
import { documentHref } from './document-href';
import { AnalysisQueueIndicator } from './AnalysisQueueIndicator';
import { AnalyzeDocumentDialog } from './AnalyzeDocumentDialog';
import { BulkAnalyzeDialog, type BulkAnalyzeTarget } from './BulkAnalyzeDialog';
import { ShareDialog } from './ShareDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { AddDocToGroupDialog } from '../groups/AddToGroupDialog';
import { useRemoveDocumentFromGroup } from '../groups/queries';

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
  const removeFromGroup = useRemoveDocumentFromGroup();

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
  const [bulkAddToGroupIds, setBulkAddToGroupIds] = useState<string[] | null>(
    null,
  );
  const [renameDoc, setRenameDoc] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // `picker` = the external group add-docs flow (selectable prop): the title
  // toggles selection instead of navigating, and per-row actions are hidden.
  // Outside the picker, the checkbox column is always on (a standard DataTable
  // affordance) so bulk actions are one click away.
  const picker = !!selectable;

  // Selection state (the DataTable owns the checkbox column; we own the Set).
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
    {
      key: 'title',
      header: t('documents.colTitle', 'Title'),
      sortValue: (d) => (d.title ?? '').toLowerCase(),
      cell: (d) =>
        picker ? (
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
    // Group column — shown when NOT already inside a group and NOT in the picker
    ...(!groupId && !picker
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
                onClick={() =>
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
    // Actions column — hidden only in the picker (group add-docs) flow.
    ...(!picker
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
                      <MoreGlyph />
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

  // The bulk-action buttons shown in the DataTable's standardized bar. The bar
  // chrome (count label, Clear) is provided by DataTable; `clear()` empties the
  // selection. Three contexts: the group add-docs picker, a group page, and the
  // library list.
  const renderBulkActions = (clear: () => void) => {
    if (selectable) {
      return (
        <Button
          size="sm"
          onClick={() => onSelectionConfirm?.(Array.from(selected))}
        >
          {t(
            'groups.addSelected',
            `Add ${selected.size} document${selected.size !== 1 ? 's' : ''}`,
          )}
        </Button>
      );
    }
    if (groupId) {
      return (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkAnalyzeOpen(true)}
          >
            {t('documents.bulkAction.analyze', 'Analyze')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const ids = Array.from(selected);
              const ok = await confirm({
                title: t(
                  'documents.bulkRemoveFromGroupTitle',
                  `Remove ${ids.length} document${ids.length === 1 ? '' : 's'} from this group?`,
                ),
                description: t(
                  'documents.bulkRemoveFromGroupDesc',
                  'The documents themselves are kept — only the group association is removed.',
                ),
                confirmLabel: t('common.remove', 'Remove'),
              });
              if (!ok) return;
              for (const id of ids) {
                removeFromGroup.mutate({ groupId, documentId: id });
              }
              clear();
            }}
          >
            {t('documents.bulkAction.removeFromGroup', 'Remove from group')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-error hover:text-error"
            onClick={async () => {
              const ids = Array.from(selected);
              const ok = await confirm({
                title: t(
                  'documents.bulkDeleteTitle',
                  `Delete ${ids.length} document${ids.length === 1 ? '' : 's'}?`,
                ),
                description: t(
                  'documents.bulkDeleteDesc',
                  'This permanently deletes the selected documents. This cannot be undone.',
                ),
                confirmLabel: t('common.delete', 'Delete'),
                variant: 'destructive',
              });
              if (!ok) return;
              for (const id of ids) del.mutate(id);
              clear();
            }}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </>
      );
    }
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkAnalyzeOpen(true)}
        >
          {t('documents.bulkAction.analyze', 'Analyze')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkAddToGroupIds(Array.from(selected))}
        >
          {t('documents.bulkAction.addToGroup', 'Add to group')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-error hover:text-error"
          onClick={async () => {
            const ids = Array.from(selected);
            const ok = await confirm({
              title: t(
                'documents.bulkDeleteTitle',
                `Delete ${ids.length} document${ids.length === 1 ? '' : 's'}?`,
              ),
              description: t(
                'documents.bulkDeleteDesc',
                'This permanently deletes the selected documents. This cannot be undone.',
              ),
              confirmLabel: t('common.delete', 'Delete'),
              variant: 'destructive',
            });
            if (!ok) return;
            for (const id of ids) del.mutate(id);
            clear();
          }}
        >
          {t('common.delete', 'Delete')}
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {!groupId && !selectable && (
        <PageHeader
          back={false}
          title={t('documents.title', 'My documents')}
          subtitle={t(
            'documents.subtitle',
            'Drafts, signed copies, and shared documents.',
          )}
          actions={
            <>
              <AnalysisQueueIndicator />
              <Button asChild>
                <Link to="/documents/new">
                  {t('common.newDocument', 'New document')}
                </Link>
              </Button>
            </>
          }
        />
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
          selection={{ selectedIds: selected, onChange: setSelected }}
          selectionLabel={(n) =>
            t('documents.nSelected', '{{n}} document(s) selected', { n })
          }
          bulkActions={(_ids, clear) => renderBulkActions(clear)}
          toolbar={
            selectable ? undefined : (
              <DocumentsToolbar
                showStatus={!groupId}
                showType={!groupId}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                typeFilter={typeFilter}
                onTypeChange={setTypeFilter}
                types={types}
              />
            )
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
      {addToGroupId &&
        (() => {
          const doc = filteredRows.find((r) => r.id === addToGroupId);
          if (!doc) return null;
          return (
            <AddDocToGroupDialog
              documents={[
                {
                  id: doc.id,
                  title: doc.title ?? '',
                  group: doc.group ?? null,
                },
              ]}
              open={!!addToGroupId}
              onOpenChange={(v) => !v && setAddToGroupId(null)}
            />
          );
        })()}
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
          targets={
            filteredRows
              .filter((r) => selected.has(r.id))
              .map((r) => ({
                id: r.id,
                title: r.title ?? '',
              })) as BulkAnalyzeTarget[]
          }
          open={bulkAnalyzeOpen}
          onOpenChange={setBulkAnalyzeOpen}
        />
      )}
      {bulkAddToGroupIds && (
        <AddDocToGroupDialog
          documents={bulkAddToGroupIds
            .map((id) => filteredRows.find((r) => r.id === id))
            .filter((d): d is NonNullable<typeof d> => !!d)
            .map((d) => ({
              id: d.id,
              title: d.title ?? '',
              group: d.group ?? null,
            }))}
          open={!!bulkAddToGroupIds}
          onOpenChange={(v) => {
            if (!v) setBulkAddToGroupIds(null);
          }}
        />
      )}
    </div>
  );
}

const ANY_STATUS = '__any__';
const ANY_TYPE = '__any__';

/**
 * Toolbar slot for the documents table: replaces the previous long row of
 * chips (which scaled badly past ~6 document types) with two dropdowns and an
 * active-filters strip. Hidden when the list is scoped to one group (the
 * group page provides its own narrower context).
 */
function DocumentsToolbar({
  showStatus,
  showType,
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  types,
}: {
  showStatus: boolean;
  showType: boolean;
  statusFilter: string | null;
  onStatusChange: (next: string | null) => void;
  typeFilter: string | null;
  onTypeChange: (next: string | null) => void;
  types: ReadonlyArray<readonly [string, string]>;
}) {
  const { t } = useTranslation();
  const typeLabel = (key: string) => types.find(([k]) => k === key)?.[1] ?? key;
  const hasFilters = !!statusFilter || !!typeFilter;
  const clearAll = () => {
    onStatusChange(null);
    onTypeChange(null);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {showStatus && (
            <Select
              value={statusFilter ?? ANY_STATUS}
              onValueChange={(v) => onStatusChange(v === ANY_STATUS ? null : v)}
            >
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue
                  placeholder={t(
                    'documents.filter.allStatuses',
                    'All statuses',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_STATUS}>
                  {t('documents.filter.allStatuses', 'All statuses')}
                </SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`, s.replace(/_/g, ' '))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showType && types.length > 0 && (
            <Select
              value={typeFilter ?? ANY_TYPE}
              onValueChange={(v) => onTypeChange(v === ANY_TYPE ? null : v)}
            >
              <SelectTrigger className="h-9 w-48 text-sm">
                <SelectValue
                  placeholder={t('documents.filter.allTypes', 'All types')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_TYPE}>
                  {t('documents.filter.allTypes', 'All types')}
                </SelectItem>
                {types.map(([key, name]) => (
                  <SelectItem key={key} value={key}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-foreground/55">
            {t('documents.filter.activeLabel', 'Filters:')}
          </span>
          {statusFilter && (
            <ActiveFilterPill
              label={t(
                `status.${statusFilter}`,
                statusFilter.replace(/_/g, ' '),
              )}
              kind={t('documents.filter.status', 'Status')}
              onClear={() => onStatusChange(null)}
            />
          )}
          {typeFilter && (
            <ActiveFilterPill
              label={typeLabel(typeFilter)}
              kind={t('documents.filter.type', 'Type')}
              onClear={() => onTypeChange(null)}
            />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-foreground/55 hover:text-foreground underline"
          >
            {t('documents.filter.clearAll', 'Clear all')}
          </button>
        </div>
      )}
    </div>
  );
}

function ActiveFilterPill({
  kind,
  label,
  onClear,
}: {
  kind: string;
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/50 px-2 py-0.5 text-primary">
      <span className="text-[10px] uppercase tracking-wide text-primary/70">
        {kind}
      </span>
      <span className="font-medium">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${kind} filter`}
        className="ml-0.5 rounded-full p-0.5 text-primary/70 hover:bg-primary/35 hover:text-primary"
      >
        <svg
          className="size-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </span>
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

function MoreGlyph() {
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
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
  status: { hasAnalysis: boolean; lastAnalyzedAt: string | null } | undefined;
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
      className="rounded bg-success/50 px-1.5 py-0.5 text-[11px] font-medium text-success-foreground hover:bg-success/35"
      title={t('documents.viewOrReanalyze', 'View / re-analyze')}
    >
      {label}
    </button>
  ) : (
    <span className="rounded bg-success/50 px-1.5 py-0.5 text-[11px] font-medium text-success-foreground">
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone: Record<string, string> = {
    draft: 'bg-warning/15 text-warning',
    in_review: 'bg-info/15 text-info',
    ready: 'bg-success/15 text-success',
    signed: 'bg-success/15 text-success',
    archived: 'bg-foreground/50 text-foreground/60',
  };
  return (
    <span
      className={cn(
        'flex-none rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone[status] ?? 'bg-foreground/50 text-foreground/60',
      )}
    >
      {t(`status.${status}`, status.replace(/_/g, ' '))}
    </span>
  );
}
