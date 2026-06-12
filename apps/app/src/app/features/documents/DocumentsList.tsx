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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
} from '@org/ui';
import { cn } from '@org/utils';
import { useEffect, useMemo, useState } from 'react';
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
import { documentHref } from './document-href';
import { ShareDialog } from './ShareDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];
// DocumentStatus enum values (prisma) — a stable facet source independent of
// the current page (server-side filtering means the page only holds one page).
const STATUSES = ['draft', 'in_review', 'ready', 'signed', 'archived'] as const;

export function DocumentsList() {
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
  const [renameDoc, setRenameDoc] = useState<{ id: string; title: string } | null>(
    null,
  );

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: 'title',
      header: t('documents.colTitle', 'Title'),
      sortValue: (d) => (d.title ?? '').toLowerCase(),
      cell: (d) => (
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
    {
      key: 'status',
      header: t('documents.colStatus', 'Status'),
      sortValue: (d) => d.status,
      cell: (d) => <StatusPill status={d.status} />,
    },
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
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (d) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('common.actions', 'Actions')}
              className="rounded p-1 text-foreground/50 hover:bg-secondary hover:text-foreground"
            >
              ⋯
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => navigate(documentHref(d))}>
              {t('common.open', 'Open')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setRenameDoc({ id: d.id, title: d.title ?? '' })}
            >
              {t('common.rename', 'Rename')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => duplicate.mutate(d.id)}>
              {t('documents.duplicate', 'Duplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShareId(d.id)}>
              {t('documents.share', 'Share')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setHistoryId(d.id)}>
              {t('documents.history', 'Version history')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-error"
              onSelect={async () => {
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
              {t('common.delete', 'Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
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
        <Button asChild>
          <Link to="/documents/new">
            {t('common.newDocument', 'New document')}
          </Link>
        </Button>
      </div>

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
          data={rows}
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
            <div className="flex flex-wrap items-center gap-2">
              <Chip active={!statusFilter} onClick={() => setStatusFilter(null)}>
                {t('common.all', 'All')}
              </Chip>
              {STATUSES.map((s) => (
                <Chip
                  key={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(statusFilter === s ? null : s)}
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
          <DialogTitle>{t('documents.renameTitle', 'Rename document')}</DialogTitle>
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
