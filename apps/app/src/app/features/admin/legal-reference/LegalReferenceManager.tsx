import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  DataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  type DataTableColumn,
} from '@org/ui';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { APP_ENV, lawUrl } from '../../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

export interface AdminCitation {
  id: string;
  act: string;
  actShort?: string;
  section?: string;
  title: string;
  summary: string;
  effectiveFrom?: string;
  supersedes?: string;
  confidence: 'high' | 'moderate' | 'low';
  verifyNote?: string;
  topics?: string[];
  appliesTo?: string[];
  commonlyPairedWith?: string[];
  draftingTips?: string;
  externalUrl?: string;
  jurisdiction?: string;
  isActive: boolean;
  isPublic: boolean;
  source: 'db' | 'code';
}

interface ListResp {
  items: AdminCitation[];
  total: number;
  page: number;
  pageSize: number;
  facets?: { acts: string[] };
}

/**
 * Server-paginated list of every citation in the catalog. Read-only summary
 * fields here — full edit lives on `/:id/edit`, create on `/new`, clone on
 * `/:id/clone`. Mirrors `LookupManager` / `SchemaManager` /
 * `VaultConfigManager`.
 */
export function LegalReferenceManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'any' | 'true' | 'false'>(
    'any',
  );
  const [publicFilter, setPublicFilter] = useState<'any' | 'true' | 'false'>(
    'any',
  );
  const [actFilter, setActFilter] = useState<string>('__any__');
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Whenever a filter changes, reset to page 0. (Sort + search already do.)
  useEffect(() => {
    setPage(0);
  }, [activeFilter, publicFilter, actFilter]);

  const reload = useMemo(
    () => () => {
      setFetching(true);
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query.trim()) params.set('q', query.trim());
      if (activeFilter !== 'any') params.set('active', activeFilter);
      if (publicFilter !== 'any') params.set('public', publicFilter);
      if (actFilter !== '__any__') params.set('act', actFilter);
      fetch(`${API_BASE_URL}/legal-ai/admin/citations?${params.toString()}`, {
        credentials: 'include',
      })
        .then((r) => r.json())
        .then((d: ListResp) => setData(d))
        .catch(() =>
          toast.error(t('legalRefs.loadFailed', 'Failed to load citations')),
        )
        .finally(() => {
          setLoading(false);
          setFetching(false);
        });
    },
    [page, pageSize, query, activeFilter, publicFilter, actFilter, t],
  );

  useEffect(reload, [reload]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const acts = data?.facets?.acts ?? [];
  const hasFilters =
    activeFilter !== 'any' ||
    publicFilter !== 'any' ||
    actFilter !== '__any__';

  const clearFilters = () => {
    setActiveFilter('any');
    setPublicFilter('any');
    setActFilter('__any__');
  };

  const toggleActive = async (row: AdminCitation, isActive: boolean) => {
    setBusyId(row.id);
    try {
      await fetch(`${API_BASE_URL}/legal-ai/admin/citations/${row.id}/active`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const togglePublic = async (row: AdminCitation, isPublic: boolean) => {
    setBusyId(row.id);
    try {
      await fetch(`${API_BASE_URL}/legal-ai/admin/citations/${row.id}/public`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      });
      reload();
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (row: AdminCitation) => {
    if (row.source === 'code') {
      toast.info(
        t(
          'legalRefs.cannotDeleteSeed',
          'Seeded citations can only be deactivated, not deleted.',
        ),
      );
      return;
    }
    const ok = await confirm({
      title: t('legalRefs.deleteTitle', 'Delete this citation?'),
      description: t(
        'legalRefs.deleteDesc',
        'It will be removed from the DB. If it has an in-code seed, the seed becomes the active source again.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (!ok) return;
    setBusyId(row.id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/legal-ai/admin/citations/${row.id}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(t('legalRefs.deleted', 'Citation deleted'));
      reload();
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<AdminCitation>[] = [
    {
      key: 'id',
      header: t('legalRefs.colId', 'Citation'),
      sortValue: (r) => r.id,
      cell: (r) => (
        <Link
          to={`/config/legal-reference/${encodeURIComponent(r.id)}/edit`}
          className="group block min-w-0"
        >
          <div className="font-mono text-xs text-foreground/80">{r.id}</div>
          <div className="text-sm font-medium text-foreground group-hover:text-primary truncate">
            {r.actShort ?? r.act}
            {r.section ? ` §${r.section}` : ''}
          </div>
        </Link>
      ),
    },
    {
      key: 'title',
      header: t('legalRefs.colTitle', 'Title'),
      cell: (r) => (
        <span className="text-sm text-foreground/80 truncate" title={r.title}>
          {r.title}
        </span>
      ),
    },
    {
      key: 'flags',
      header: t('legalRefs.colFlags', 'Flags'),
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant={r.source === 'db' ? 'info' : 'secondary'}
            outline
            className="text-[10px]"
          >
            {r.source}
          </Badge>
          <Badge
            variant={
              r.confidence === 'high'
                ? 'success'
                : r.confidence === 'low'
                  ? 'error'
                  : 'warning'
            }
            outline
            className="text-[10px]"
          >
            {r.confidence}
          </Badge>
          {r.supersedes && (
            <Badge variant="warning" className="text-[10px]">
              replaces {r.supersedes}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'active',
      header: t('legalRefs.colActive', 'Active'),
      cell: (r) => (
        <Switch
          checked={r.isActive}
          disabled={r.source === 'code' || busyId === r.id}
          onCheckedChange={(v) => toggleActive(r, v)}
        />
      ),
    },
    {
      key: 'public',
      header: t('legalRefs.colPublic', 'Public'),
      cell: (r) => (
        <Switch
          checked={r.isPublic}
          disabled={r.source === 'code' || busyId === r.id}
          onCheckedChange={(v) => togglePublic(r, v)}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-36',
      pinned: true,
      cell: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            title={t('common.edit', 'Edit')}
            onClick={() =>
              navigate(
                `/config/legal-reference/${encodeURIComponent(r.id)}/edit`,
              )
            }
          >
            <EditIcon />
          </IconButton>
          <IconButton
            title={t('legalRefs.clone', 'Duplicate')}
            onClick={() =>
              navigate(
                `/config/legal-reference/${encodeURIComponent(r.id)}/clone`,
              )
            }
          >
            <CopyIcon />
          </IconButton>
          <a
            href={lawUrl(r.id)}
            target="_blank"
            rel="noreferrer"
            title={t('legalRefs.viewPublic', 'View public page')}
            className="inline-flex size-7 items-center justify-center rounded-md text-foreground/60 hover:bg-secondary/60 hover:text-foreground"
          >
            <ExternalIcon />
          </a>
          <IconButton
            danger
            title={t('common.delete', 'Delete')}
            disabled={busyId === r.id || r.source === 'code'}
            onClick={() => onDelete(r)}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">
            {t('legalRefs.managerTitle', 'Citations')}
          </h3>
          <p className="text-sm text-foreground/55">
            {t(
              'legalRefs.managerSubtitle',
              'Curated statutes used by AI drafting + the public /law catalog. Code seeds are read-only; DB rows override.',
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/law" target="_blank" rel="noreferrer">
              {t('legalRefs.openPublic', 'Public catalog ↗')}
            </Link>
          </Button>
          <Button onClick={() => navigate('/config/legal-reference/new')}>
            {t('legalRefs.add', '+ Add citation')}
          </Button>
        </div>
      </div>

      <DataTable
        tableId="admin.legal-reference.citations"
        data={data?.items ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        searchPlaceholder={t(
          'legalRefs.searchPlaceholder',
          'Search id / act / section / title / topic…',
        )}
        pageSizeOptions={[10, 25, 50, 100]}
        empty={t('legalRefs.empty', 'No citations match your filters.')}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={activeFilter}
              onValueChange={(v) =>
                setActiveFilter(v as 'any' | 'true' | 'false')
              }
            >
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue
                  placeholder={t('legalRefs.filter.activeAny', 'Any status')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">
                  {t('legalRefs.filter.activeAny', 'Any status')}
                </SelectItem>
                <SelectItem value="true">
                  {t('legalRefs.filter.activeTrue', 'Active')}
                </SelectItem>
                <SelectItem value="false">
                  {t('legalRefs.filter.activeFalse', 'Inactive')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={publicFilter}
              onValueChange={(v) =>
                setPublicFilter(v as 'any' | 'true' | 'false')
              }
            >
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue
                  placeholder={t(
                    'legalRefs.filter.visibilityAny',
                    'Any visibility',
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">
                  {t('legalRefs.filter.visibilityAny', 'Any visibility')}
                </SelectItem>
                <SelectItem value="true">
                  {t('legalRefs.filter.publicTrue', 'Public')}
                </SelectItem>
                <SelectItem value="false">
                  {t('legalRefs.filter.publicFalse', 'Private')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={actFilter} onValueChange={setActFilter}>
              <SelectTrigger className="h-9 w-56 text-sm">
                <SelectValue
                  placeholder={t('legalRefs.filter.codeAny', 'All codes')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">
                  {t('legalRefs.filter.codeAny', 'All codes')}
                </SelectItem>
                {acts.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                {t('common.clearAll', 'Clear all')}
              </Button>
            )}
          </div>
        }
        server={{
          page,
          pageCount,
          total,
          onPageChange: setPage,
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
          loading: fetching,
        }}
      />
    </div>
  );
}

// ── Icons + button shim — mirrors the LookupManager pattern ────────────
function IconButton({
  title,
  onClick,
  danger,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex size-7 items-center justify-center rounded-md text-foreground/60 hover:bg-secondary/60 hover:text-foreground disabled:opacity-40 ${
        danger ? 'hover:text-error hover:bg-error/10' : ''
      }`}
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
