import { cn } from '@org/utils';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

export interface DataTableColumn<T> {
  /** Stable id; also the sort key. */
  key: string;
  header: ReactNode;
  /** Cell content. Defaults to nothing — provide for every visible column. */
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** e.g. 'w-32' / 'w-1/3'. */
  width?: string;
}

export interface DataTableSort {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * Opt-in server-driven mode. When provided, the table does NOT filter/sort/
 * paginate internally — it renders `data` as given (the current page) and
 * delegates page/sort/search changes to these callbacks. Use for unbounded,
 * user-owned lists (documents, batches). Omit for small, fully-loaded lists.
 */
export interface DataTableServer {
  /** 0-based current page index. */
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Current page size (for the page-size selector). */
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  /** Dim the rows while the next page is being fetched. */
  loading?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  /** Return a row's searchable text to enable the search box. */
  search?: (row: T) => string;
  searchPlaceholder?: string;
  /** Extra controls (filter chips, etc.) shown in the toolbar. */
  toolbar?: ReactNode;
  /** Return expanded content to make rows expandable (adds a chevron column). */
  renderExpanded?: (row: T) => ReactNode;
  pageSize?: number;
  /** Show a "Rows" page-size dropdown with these options (e.g. [10,50,100,200]). */
  pageSizeOptions?: number[];
  initialSort?: DataTableSort;
  empty?: ReactNode;
  className?: string;
  /**
   * Provide to switch to server-driven paging/sort/search (see DataTableServer).
   * When set, internal filtering/sorting/slicing is bypassed and `data` is
   * treated as the already-fetched current page.
   */
  server?: DataTableServer;
}

/**
 * A compact, dependency-free data table: search, sortable columns, always-on
 * pagination, optional expandable rows, and a toolbar slot for filters.
 *
 * Default: client-side over the rows it's given (small, fully-loaded lists).
 * Pass `server` to delegate paging/sort/search to the backend for unbounded,
 * user-owned lists (documents, batches).
 */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  search,
  searchPlaceholder = 'Search…',
  toolbar,
  renderExpanded,
  pageSize = 10,
  pageSizeOptions,
  initialSort,
  empty,
  className,
  server,
}: DataTableProps<T>) {
  const serverMode = !!server;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSort | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [localPageSize, setLocalPageSize] = useState(pageSize);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Effective page size: server-controlled in server mode, local otherwise.
  const effectivePageSize = serverMode
    ? server.pageSize ?? pageSize
    : localPageSize;
  const changePageSize = (n: number) => {
    if (serverMode) server.onPageSizeChange?.(n);
    else {
      setLocalPageSize(n);
      setPage(0);
    }
  };

  // Active query/sort come from the server props in server mode, else local.
  const activeQuery = serverMode ? server.query ?? '' : query;
  const activeSort = serverMode ? server.sort ?? null : sort;

  const filtered = useMemo(() => {
    if (serverMode) return data;
    const q = query.trim().toLowerCase();
    if (!q || !search) return data;
    return data.filter((r) => search(r).toLowerCase().includes(q));
  }, [serverMode, data, query, search]);

  const sorted = useMemo(() => {
    if (serverMode || !sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [serverMode, filtered, sort, columns]);

  // Page math: trust the server's counts in server mode, else derive locally.
  const pageCount = serverMode
    ? Math.max(1, server.pageCount)
    : Math.max(1, Math.ceil(sorted.length / effectivePageSize));
  const current = serverMode
    ? Math.min(server.page, pageCount - 1)
    : Math.min(page, pageCount - 1);
  const total = serverMode ? server.total : sorted.length;
  const start = current * effectivePageSize;
  const rows = serverMode
    ? data
    : sorted.slice(start, start + effectivePageSize);
  const colSpan = columns.length + (renderExpanded ? 1 : 0);

  const goToPage = (p: number) => {
    if (serverMode) server.onPageChange(p);
    else setPage(p);
  };

  const toggleSort = (key: string) => {
    const next: DataTableSort =
      activeSort?.key === key
        ? { key, dir: activeSort.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' };
    if (serverMode) server.onSortChange?.(next);
    else setSort(next);
  };
  const toggleRow = (k: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className={cn('space-y-3', className)}>
      {(search || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {search && (
            <Input
              value={activeQuery}
              onChange={(e) => {
                if (serverMode) {
                  server.onQueryChange?.(e.target.value);
                } else {
                  setQuery(e.target.value);
                  setPage(0);
                }
              }}
              placeholder={searchPlaceholder}
              className="h-9 w-full sm:w-64"
            />
          )}
          {toolbar}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-foreground/55">
              {renderExpanded && <th className="w-8" />}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-3 py-2 font-medium',
                    c.width,
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                    c.sortValue && 'cursor-pointer select-none hover:text-foreground',
                  )}
                  onClick={c.sortValue ? () => toggleSort(c.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {c.sortValue && activeSort?.key === c.key && (
                      <Chevron dir={activeSort.dir === 'asc' ? 'up' : 'down'} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className={cn(
              'divide-y divide-border/60',
              server?.loading && 'opacity-50 transition-opacity',
            )}
          >
            {rows.map((row) => {
              const k = rowKey(row);
              const isOpen = expanded.has(k);
              return (
                <Fragment key={k}>
                  <tr className="transition hover:bg-secondary/30">
                    {renderExpanded && (
                      <td className="pl-3">
                        <button
                          type="button"
                          aria-label="Toggle details"
                          onClick={() => toggleRow(k)}
                          className="rounded p-1 text-foreground/50 hover:bg-secondary hover:text-foreground"
                        >
                          <Chevron dir={isOpen ? 'down' : 'right'} />
                        </button>
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-3 py-2.5 align-middle',
                          c.align === 'right' && 'text-right',
                          c.align === 'center' && 'text-center',
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                  {renderExpanded && isOpen && (
                    <tr className="bg-secondary/20">
                      <td colSpan={colSpan} className="px-4 py-3">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-3 py-10 text-center text-sm text-foreground/50"
                >
                  {empty ?? 'Nothing to show.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-foreground/55">
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                {start + 1}–{start + rows.length} of {total}
              </span>
              {pageSizeOptions && pageSizeOptions.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span>Rows</span>
                  <Select
                    value={String(effectivePageSize)}
                    onValueChange={(v) => changePageSize(Number(v))}
                  >
                    <SelectTrigger className="h-7 w-[4.5rem] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizeOptions.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PagerButton
                disabled={current === 0 || !!server?.loading}
                onClick={() => goToPage(current - 1)}
              >
                Prev
              </PagerButton>
              <span className="tabular-nums">
                {current + 1} / {pageCount}
              </span>
              <PagerButton
                disabled={current >= pageCount - 1 || !!server?.loading}
                onClick={() => goToPage(current + 1)}
              >
                Next
              </PagerButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-border px-2 py-1 transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Chevron({ dir }: { dir: 'up' | 'down' | 'right' }) {
  const rot =
    dir === 'up' ? '-rotate-90' : dir === 'down' ? 'rotate-90' : 'rotate-0';
  return (
    <svg
      className={cn('size-3.5 transition-transform', rot)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
