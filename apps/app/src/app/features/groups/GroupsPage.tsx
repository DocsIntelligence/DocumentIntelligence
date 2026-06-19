import {
  Button,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterBar,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { PageHeader } from '../../components/page-header';
import { useCreateGroup, useDeleteGroup, useGroupsPage } from './queries';
import { useLookupOptions } from '../documents/queries';
import type { DocumentGroupSummary } from '@org/api-client';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function GroupsPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const del = useDeleteGroup();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    { key: 'updated', dir: 'desc' },
  );
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPage(0);
  }, [query, kindFilter, sort, pageSize]);

  const { data, isLoading, isFetching, isPlaceholderData } = useGroupsPage({
    page,
    pageSize,
    q: query.trim() || undefined,
    kind: kindFilter ?? undefined,
    sort: (sort?.key as 'name' | 'updated' | 'created') ?? 'updated',
    dir: sort?.dir ?? 'desc',
  });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Kind options from lookup (dynamic)
  const { data: lookupOptions } = useLookupOptions();
  const kindOptions = lookupOptions?.['document_group_kinds'] ?? [
    { value: 'folder', label: 'Folder' },
    { value: 'bundle', label: 'Bundle' },
    { value: 'matter', label: 'Matter' },
  ];

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: t('groups.deleteTitle', 'Delete group'),
      description: t(
        'groups.deleteDesc',
        `Are you sure you want to delete "${name}"? Documents inside will be ungrouped, not deleted.`,
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) del.mutate(id);
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: t('groups.bulkDeleteTitle', 'Delete {{n}} group(s)?', {
        n: ids.length,
      }),
      description: t(
        'groups.bulkDeleteDesc',
        'Documents inside are ungrouped, not deleted.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (!ok) return;
    for (const id of ids) del.mutate(id);
    setSelected(new Set());
  };

  const kindIcon = (kind: string) =>
    kind === 'bundle' ? '📦' : kind === 'matter' ? '⚖️' : '📁';

  const columns: DataTableColumn<DocumentGroupSummary>[] = [
    {
      key: 'name',
      header: t('groups.colName', 'Name'),
      sortValue: (g) => g.name.toLowerCase(),
      cell: (g) => (
        <Link to={`/groups/${g.id}`} className="group block min-w-0">
          <span className="block truncate font-medium text-foreground group-hover:text-primary">
            {kindIcon(g.kind)} {g.name}
          </span>
        </Link>
      ),
    },
    {
      key: 'kind',
      header: t('groups.colKind', 'Kind'),
      sortValue: (g) => g.kind,
      cell: (g) => (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/60">
          {g.kind}
        </span>
      ),
    },
    {
      key: 'documents',
      header: t('groups.colDocs', 'Documents'),
      align: 'right',
      sortValue: (g) => g.documentCount,
      cell: (g) => (
        <span className="text-foreground/60">{g.documentCount}</span>
      ),
    },
    {
      key: 'updated',
      header: t('common.updated', 'Updated'),
      align: 'right',
      sortValue: (g) => g.updatedAt,
      cell: (g) => (
        <span className="text-foreground/55">
          {new Date(g.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      pinned: true,
      cell: (g) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            danger
            title={t('common.delete', 'Delete')}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(g.id, g.name);
            }}
          >
            <TrashGlyph />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={false}
        title={t('groups.title', 'Document Groups')}
        subtitle={t(
          'groups.subtitle',
          'Organize related documents into folders, bundles, or matters.',
        )}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            {t('groups.new', '+ New group')}
          </Button>
        }
      />

      <DataTable
        tableId="groups.list"
        data={rows}
        columns={columns}
        rowKey={(g) => g.id}
        search={(g) => g.name}
        searchPlaceholder={t('groups.search', 'Search groups…')}
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
        selectionLabel={(n) => t('groups.nSelected', '{{n}} selected', { n })}
        bulkActions={() => (
          <Button
            variant="error"
            size="sm"
            onClick={handleBulkDelete}
            disabled={del.isPending}
          >
            {t('common.delete', 'Delete')}
          </Button>
        )}
        toolbar={
          <FilterBar
            selects={[
              {
                id: 'kind',
                value: kindFilter ?? '',
                onChange: (v) => setKindFilter(v || null),
                options: kindOptions.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                })),
                allLabel: t('groups.filter.allKinds', 'All kinds'),
                widthClassName: 'w-44',
              },
            ]}
            onClear={() => {
              setKindFilter(null);
              setQuery('');
            }}
            clearLabel={t('common.clear', 'Clear')}
          />
        }
        empty={t('groups.noMatch', 'No groups match these filters.')}
      />

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        kindOptions={kindOptions}
      />
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  kindOptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kindOptions: Array<{ value: string; label: string }>;
}) {
  const { t } = useTranslation();
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('folder');

  const handleSubmit = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), kind },
      {
        onSuccess: () => {
          onOpenChange(false);
          setName('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('groups.createTitle', 'Create document group')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="group-name">{t('groups.name', 'Group name')}</Label>
            <Input
              id="group-name"
              placeholder={t(
                'groups.namePlaceholder',
                'e.g. Sharma Property Purchase',
              )}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('groups.kind', 'Kind')}</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || create.isPending}
            onClick={handleSubmit}
          >
            {create.isPending
              ? t('common.creating', 'Creating…')
              : t('common.create', 'Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IconButton({
  title,
  danger,
  onClick,
  children,
}: {
  title: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 transition hover:bg-secondary',
        danger
          ? 'text-error hover:text-error'
          : 'text-foreground/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
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
