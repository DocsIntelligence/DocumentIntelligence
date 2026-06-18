import type { EstateAsset, ListEstateAssetsQuery } from '@org/api-client';
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { PageHeader } from '../../../components/page-header';
import { useActiveProfile } from '../profile-context';
import {
  formatMoney,
  useAssetTypes,
  useAssets,
  useBulkDeleteAssets,
  useDeleteAsset,
} from '../queries';

/** Horizontal ⋯ overflow icon — the standard row-actions trigger. */
function MoreIcon() {
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

/** Asset inventory list — DataTable + server paging + a Select type filter
 *  (docs/13 §8 / UI-consistency rules). */
export function EstateAssetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string>('all');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    {
      key: 'updated',
      dir: 'desc',
    },
  );

  const params: ListEstateAssetsQuery = {
    page,
    pageSize,
    q: query || undefined,
    type: type === 'all' ? undefined : type,
    sort: (sort?.key as ListEstateAssetsQuery['sort']) ?? 'updated',
    dir: sort?.dir ?? 'desc',
  };
  const { data, isFetching, isPlaceholderData } = useAssets(params);
  const { data: types } = useAssetTypes();
  const del = useDeleteAsset();
  const bulkDel = useBulkDeleteAssets();
  const confirm = useConfirm();
  const { maskAmounts } = useActiveProfile();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = data?.items ?? [];
  const bulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: t('estate.bulkDeleteTitle', 'Remove {{n}} asset(s)?', {
        n: ids.length,
      }),
      description: t(
        'estate.bulkDeleteDesc',
        'They are soft-deleted (hidden from lists + net worth) and their history is kept.',
      ),
      confirmLabel: t('common.remove', 'Remove'),
      variant: 'destructive',
    });
    if (!ok) return;
    await bulkDel.mutateAsync(ids);
    setSelected(new Set());
  };

  const typeLabels = useMemo(
    () => new Map((types ?? []).map((t) => [t.key, t.label])),
    [types],
  );

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const columns: DataTableColumn<EstateAsset>[] = [
    {
      key: 'type',
      header: t('estate.type', 'Type'),
      width: 'w-28',
      defaultWidth: 120,
      sortValue: (r) => r.type,
      cell: (r) => (
        <Badge variant="secondary">{typeLabels.get(r.type) ?? r.type}</Badge>
      ),
    },
    {
      key: 'label',
      header: t('estate.name', 'Name'),
      defaultWidth: 280,
      sortValue: (r) => r.label,
      cell: (r) => (
        <Link
          to={`/estate/assets/${r.id}`}
          className="font-medium hover:underline"
        >
          {r.label}
        </Link>
      ),
    },
    {
      key: 'institution',
      header: t('estate.institution', 'Institution'),
      defaultWidth: 200,
      cell: (r) => (
        <span className="text-foreground/70">{r.institution ?? '—'}</span>
      ),
    },
    {
      key: 'value',
      header: t('estate.value', 'Value'),
      align: 'right',
      width: 'w-28',
      defaultWidth: 120,
      sortValue: (r) => r.value,
      cell: (r) => formatMoney(r.value, r.currency, maskAmounts),
    },
    {
      key: 'updated',
      header: t('estate.updated', 'Updated'),
      width: 'w-24',
      defaultWidth: 96,
      sortValue: (r) => r.updatedAt,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {new Date(r.updatedAt).toLocaleDateString('en-IN')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-16',
      defaultWidth: 64,
      pinned: true,
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.actions', 'Actions')}
            >
              <MoreIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigate(`/estate/assets/${r.id}`)}
            >
              {t('common.open', 'Open')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => del.mutate(r.id)}>
              {t('common.delete', 'Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('estate.assetsTitle', 'Assets')}
        subtitle={t(
          'estate.assetsSubtitle',
          'Everything you own, tracked over time.',
        )}
        backTo="/estate"
        actions={
          <Button asChild>
            <Link to="/estate/assets/new">
              {t('estate.addAsset', 'Add asset')}
            </Link>
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('estate.allTypes', 'All types')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('estate.allTypes', 'All types')}
            </SelectItem>
            {(types ?? []).map((tp) => (
              <SelectItem key={tp.key} value={tp.key}>
                {tp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        tableId="estate.assets"
        data={items}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder={t('estate.search', 'Search assets…')}
        pageSizeOptions={[10, 20, 50, 100]}
        empty={t('estate.assetsEmpty', 'No assets yet. Add your first one.')}
        selection={{ selectedIds: selected, onChange: setSelected }}
        selectionLabel={(n) => t('estate.nSelected', '{{n}} selected', { n })}
        bulkActions={() => (
          <Button
            variant="error"
            size="sm"
            onClick={bulkDelete}
            disabled={bulkDel.isPending}
          >
            {t('common.delete', 'Delete')}
          </Button>
        )}
        server={{
          page,
          pageCount,
          total,
          onPageChange: setPage,
          sort,
          onSortChange: (s) => {
            setSort(s);
            setPage(0);
          },
          query,
          onQueryChange: (q) => {
            setQuery(q);
            setPage(0);
          },
          pageSize,
          onPageSizeChange: (ps) => {
            setPageSize(ps);
            setPage(0);
          },
          loading: isFetching && isPlaceholderData,
        }}
      />
    </div>
  );
}
