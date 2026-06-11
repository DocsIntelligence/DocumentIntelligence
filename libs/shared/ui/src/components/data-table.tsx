import { cn } from '@org/utils';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Input } from './input';

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
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode;
  className?: string;
}

/**
 * A compact, dependency-free admin data table: search, sortable columns,
 * always-on pagination, optional expandable rows, and a toolbar slot for
 * filters. Client-side over the rows it's given (admin lists are small).
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
  initialSort,
  empty,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    initialSort ?? null,
  );
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !search) return data;
    return data.filter((r) => search(r).toLowerCase().includes(q));
  }, [data, query, search]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
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
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const rows = sorted.slice(start, start + pageSize);
  const colSpan = columns.length + (renderExpanded ? 1 : 0);

  const toggleSort = (key: string) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
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
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
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
                    {c.sortValue && sort?.key === c.key && (
                      <Chevron dir={sort.dir === 'asc' ? 'up' : 'down'} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
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

        {sorted.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-foreground/55">
            <span className="tabular-nums">
              {start + 1}–{Math.min(start + pageSize, sorted.length)} of{' '}
              {sorted.length}
            </span>
            <div className="flex items-center gap-2">
              <PagerButton
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                Prev
              </PagerButton>
              <span className="tabular-nums">
                {current + 1} / {pageCount}
              </span>
              <PagerButton
                disabled={current >= pageCount - 1}
                onClick={() => setPage(current + 1)}
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
