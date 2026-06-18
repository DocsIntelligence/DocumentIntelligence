import type { VaultEntitySummary } from '@org/api-client';
import { KIND_BADGE, KIND_LABEL } from './kinds';
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { PageHeader } from '../../components/page-header';
import {
  useDeleteVaultEntity,
  useDuplicateVaultEntity,
  useUpdateVaultEntity,
  useVaultEntities,
} from './queries';

function relativeDate(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Document Vault — entities (person/company/…) and their saved details + docs.
 *  Table → row → edit (consistent with the other managers). */
const PAGE_SIZE = 20;
type Sort = { key: string; dir: 'asc' | 'desc' };

export function VaultPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<Sort | null>({ key: 'updated', dir: 'desc' });
  const [query, setQuery] = useState('');

  const sortKey = (['label', 'kind', 'updated', 'documents'] as const).includes(
    (sort?.key ?? '') as 'label' | 'kind' | 'updated' | 'documents',
  )
    ? (sort?.key as 'label' | 'kind' | 'updated' | 'documents')
    : 'updated';
  const { data, isFetching, isPlaceholderData } = useVaultEntities({
    q: query || undefined,
    page,
    pageSize,
    sort: sortKey,
    dir: sort?.dir ?? 'desc',
  });
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const columns: DataTableColumn<VaultEntitySummary>[] = [
    {
      key: 'kind',
      header: t('vault.kind', 'Type'),
      width: 'w-28',
      sortValue: (r) => r.kind,
      cell: (r) => (
        <Badge variant={KIND_BADGE[r.kind]}>{KIND_LABEL[r.kind]}</Badge>
      ),
    },
    {
      key: 'label',
      header: t('vault.label', 'Name / label'),
      sortValue: (r) => r.label,
      cell: (r) => (
        <Link
          to={`/vault/${r.id}`}
          className="flex items-center gap-2 font-medium hover:underline"
        >
          <span className="truncate">{r.label}</span>
          {!r.isActive && (
            <Badge variant="secondary" outline className="text-[10px]">
              {t('vault.disabled', 'Disabled')}
            </Badge>
          )}
        </Link>
      ),
    },
    {
      key: 'documents',
      header: t('vault.docs', 'Docs'),
      align: 'center',
      width: 'w-16',
      sortValue: (r) => r.documentCount,
      cell: (r) => r.documentCount,
    },
    {
      key: 'updated',
      header: t('vault.updated', 'Updated'),
      width: 'w-28',
      sortValue: (r) => r.updatedAt,
      cell: (r) => (
        <span className="text-xs text-muted-foreground">
          {relativeDate(r.updatedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-12',
      cell: (r) => <RowActions row={r} />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        back={false}
        title={t('vault.title', 'Document Vault')}
        subtitle={t(
          'vault.subtitle',
          'Save people & companies once — their details and ID documents — then autofill any document. Sensitive fields are encrypted and masked.',
        )}
        actions={
          <Button asChild>
            <Link to="/vault/new">{t('vault.new', 'New entity')}</Link>
          </Button>
        }
      />

      <DataTable
        tableId="vault.list"
        data={data?.items ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder={t('vault.search', 'Search entities…')}
        pageSizeOptions={[10, 20, 50, 100]}
        empty={t('vault.empty', 'No saved entities yet. Add yourself, a company, or a counterparty.')}
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

function RowActions({ row: e }: { row: VaultEntitySummary }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const duplicate = useDuplicateVaultEntity();
  const del = useDeleteVaultEntity();
  const update = useUpdateVaultEntity(e.id);

  const onDelete = async () => {
    const ok = await confirm({
      title: t('vault.deleteTitle', 'Delete this entity?'),
      description: t(
        'vault.deleteDesc',
        'Its details and all attached documents are permanently removed.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) del.mutate(e.id);
  };

  const onToggleActive = async () => {
    const ok = await confirm({
      title: e.isActive
        ? t('vault.disableTitle', 'Disable this entity?')
        : t('vault.enableTitle', 'Enable this entity?'),
      description: e.isActive
        ? t(
            'vault.disableDesc',
            'It will be hidden from autofill and pickers, but kept with its attached documents.',
          )
        : t('vault.enableDesc', 'It will appear in autofill and pickers again.'),
      confirmLabel: e.isActive
        ? t('vault.disable', 'Disable')
        : t('vault.enable', 'Enable'),
    });
    if (ok) update.mutate({ isActive: !e.isActive });
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton
        title={t('vault.open', 'Open')}
        onClick={() => navigate(`/vault/${e.id}`)}
      >
        <OpenGlyph />
      </IconButton>
      <IconButton
        title={t('common.edit', 'Edit')}
        onClick={() => navigate(`/vault/${e.id}/edit`)}
      >
        <EditGlyph />
      </IconButton>
      <IconButton
        danger
        title={t('common.delete', 'Delete')}
        onClick={onDelete}
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
            disabled={duplicate.isPending}
            onSelect={() => duplicate.mutate(e.id)}
          >
            {t('vault.duplicate', 'Duplicate')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={update.isPending}
            onSelect={onToggleActive}
          >
            {e.isActive
              ? t('vault.disable', 'Disable')
              : t('vault.enable', 'Enable')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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

function OpenGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function EditGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function CopyGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
