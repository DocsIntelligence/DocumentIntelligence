import { cn } from '@org/utils';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type ExpandedState,
  type PaginationState,
  type Row,
  type SortingState,
} from '@tanstack/react-table';
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

export interface DataTableColumn<T> {
  /** Stable id; also the sort key + persisted column identifier. */
  key: string;
  header: ReactNode;
  /** Cell content. Provide for every visible column. */
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  /** Extra classes applied to the cell. */
  className?: string;
  /** Legacy Tailwind width hint (e.g. 'w-32') — used as fallback when no pixel width. */
  width?: string;
  /** Default pixel width — used when no user override exists. */
  defaultWidth?: number;
  /** Min pixel width for resize. Defaults to 60. */
  minWidth?: number;
  /** Max pixel width for resize. Defaults to 800. */
  maxWidth?: number;
  /**
   * Prevent the user from reordering or resizing this column, and flush it
   * to an edge regardless of persisted order.
   *   `true`    → flush right (back-compat — actions columns).
   *   `'right'` → flush right (explicit).
   *   `'left'`  → flush left (e.g. a leading checkbox column).
   */
  pinned?: boolean | 'left' | 'right';
}

export interface DataTableSort {
  key: string;
  dir: 'asc' | 'desc';
}

/**
 * Opt-in row selection. When provided, the table renders a narrow, always-on
 * leading checkbox column (header = select-all-visible) and — when at least one
 * row is selected and `bulkActions` is given — a standardized action bar just
 * above the table. Selection state is owned by the caller (a `Set` of row ids).
 */
export interface DataTableSelection {
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Restrict which rows can be selected; non-selectable rows show no checkbox. */
  isSelectable?: (rowId: string) => boolean;
}

/**
 * Opt-in server-driven mode. When provided, the table does NOT filter/sort/
 * paginate internally — it renders `data` as given (the current page) and
 * delegates page/sort/search changes to these callbacks.
 */
export interface DataTableServer {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  sort?: DataTableSort | null;
  onSortChange?: (sort: DataTableSort | null) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  loading?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  search?: (row: T) => string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  /** Enable the leading checkbox column + standardized bulk-action bar. */
  selection?: DataTableSelection;
  /**
   * Render the bulk-action buttons shown in the bar when ≥1 row is selected.
   * Receives the selected ids and a `clear()` helper. The bar chrome (the
   * "{n} selected" label, themed container, and Clear button) is provided.
   */
  bulkActions?: (ids: string[], clear: () => void) => ReactNode;
  /** Override the "{n} selected" label (e.g. pluralized / translated). */
  selectionLabel?: (count: number) => ReactNode;
  renderExpanded?: (row: T) => ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  initialSort?: DataTableSort;
  empty?: ReactNode;
  className?: string;
  server?: DataTableServer;
  /**
   * Stable id for persisting per-user column order + widths in localStorage
   * (key: `dt:<tableId>`). Without it, resize/reorder still work but are
   * in-memory only.
   */
  tableId?: string;
  resizableColumns?: boolean;
  reorderableColumns?: boolean;
}

interface PersistedTableState {
  widths: ColumnSizingState;
  order: ColumnOrderState;
}

const EMPTY_STATE: PersistedTableState = { widths: {}, order: [] };

const loadState = (tableId?: string): PersistedTableState => {
  if (!tableId || typeof window === 'undefined') return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(`dt:${tableId}`);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedTableState>;
    return {
      widths: parsed.widths ?? {},
      order: Array.isArray(parsed.order) ? parsed.order : [],
    };
  } catch {
    return EMPTY_STATE;
  }
};

const saveState = (tableId: string | undefined, state: PersistedTableState) => {
  if (!tableId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`dt:${tableId}`, JSON.stringify(state));
  } catch {
    /* quota / private-mode — ignore */
  }
};

interface ColumnMeta {
  align?: 'left' | 'right' | 'center';
  className?: string;
  widthClass?: string;
  pinned?: boolean | 'left' | 'right';
}

/** Map a Tailwind `w-NN` / `w-[NNNpx]` hint to its pixel equivalent. */
const tailwindWidthToPx = (cls?: string): number | undefined => {
  if (!cls) return undefined;
  const bracket = cls.match(/^w-\[(\d+)px\]$/);
  if (bracket) return Number(bracket[1]);
  const scale = cls.match(/^w-(\d+)$/);
  if (scale) return Number(scale[1]) * 4; // Tailwind: 1 unit = 0.25rem = 4 px
  return undefined;
};

/**
 * A dependency-light data table built on `@tanstack/react-table`. Provides
 * search, sortable columns, pagination, expandable rows, column resize + drag-
 * to-reorder, and per-user persistence via `tableId`.
 *
 * Default: client-side over the rows it's given. Pass `server` to delegate
 * paging/sort/search to the backend for unbounded lists.
 */
export function DataTable<T>({
  data,
  columns: providedColumns,
  rowKey,
  search,
  searchPlaceholder = 'Search…',
  toolbar,
  selection,
  bulkActions,
  selectionLabel,
  renderExpanded,
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100, 200],
  initialSort,
  empty,
  className,
  server,
  tableId,
  resizableColumns = true,
  reorderableColumns = true,
}: DataTableProps<T>) {
  const serverMode = !!server;

  // ── Selection (optional leading checkbox column) ─────────────────────────
  const selectableIds = useMemo(
    () =>
      selection
        ? data
            .map(rowKey)
            .filter((id) => !selection.isSelectable || selection.isSelectable(id))
        : [],
    [selection, data, rowKey],
  );
  const allVisibleSelected =
    !!selection &&
    selectableIds.length > 0 &&
    selectableIds.every((id) => selection.selectedIds.has(id));

  const selectionColumn = useMemo<DataTableColumn<T> | null>(() => {
    if (!selection) return null;
    const toggleAll = () => {
      const next = new Set(selection.selectedIds);
      if (allVisibleSelected) for (const id of selectableIds) next.delete(id);
      else for (const id of selectableIds) next.add(id);
      selection.onChange(next);
    };
    return {
      key: '__select__',
      pinned: 'left',
      // Narrow, fixed: just the checkbox + tight padding.
      width: 'w-9',
      defaultWidth: 36,
      minWidth: 36,
      maxWidth: 36,
      className: 'px-2',
      header: (
        <SelectCheckbox
          checked={allVisibleSelected}
          onClick={toggleAll}
          label="Toggle selection for all visible rows"
        />
      ),
      cell: (row: T) => {
        const id = rowKey(row);
        if (selection.isSelectable && !selection.isSelectable(id)) return null;
        const checked = selection.selectedIds.has(id);
        return (
          <SelectCheckbox
            checked={checked}
            onClick={() => {
              const next = new Set(selection.selectedIds);
              if (checked) next.delete(id);
              else next.add(id);
              selection.onChange(next);
            }}
            label="Toggle selection"
          />
        );
      },
    };
  }, [selection, selectableIds, allVisibleSelected, rowKey]);

  const userColumns = useMemo(
    () => (selectionColumn ? [selectionColumn, ...providedColumns] : providedColumns),
    [selectionColumn, providedColumns],
  );

  // ── Persisted column state (widths + order) ─────────────────────────────
  const [persisted, setPersisted] = useState<PersistedTableState>(() =>
    loadState(tableId),
  );
  useEffect(() => setPersisted(loadState(tableId)), [tableId]);

  const writeState = (next: PersistedTableState) => {
    setPersisted(next);
    saveState(tableId, next);
  };

  // ── Map user columns → react-table ColumnDef ────────────────────────────
  const columnDefs = useMemo<ColumnDef<T>[]>(
    () =>
      userColumns.map((c) => ({
        id: c.key,
        header: () => c.header,
        cell: ({ row }) => c.cell(row.original),
        // sortValue powers the sort comparator (client mode).
        accessorFn: c.sortValue ?? ((row: T) => rowKey(row)),
        enableSorting: !!c.sortValue,
        enableResizing: !c.pinned,
        // Prefer explicit pixel defaults; fall back to Tailwind hint, then 180.
        size: c.defaultWidth ?? tailwindWidthToPx(c.width) ?? 180,
        minSize: c.minWidth ?? 60,
        maxSize: c.maxWidth ?? 800,
        meta: {
          align: c.align,
          className: c.className,
          widthClass: c.width,
          pinned: c.pinned,
        } satisfies ColumnMeta,
      })),
    [userColumns, rowKey],
  );

  // Column header by id — used to label values in the mobile card view.
  const columnHeaderById = useMemo(
    () => new Map(userColumns.map((c) => [c.key, c.header])),
    [userColumns],
  );

  // ── Search (global filter) ───────────────────────────────────────────────
  const [globalFilter, setGlobalFilter] = useState('');
  const activeQuery = serverMode ? (server.query ?? '') : globalFilter;

  // ── Sort ────────────────────────────────────────────────────────────────
  const [sorting, setSorting] = useState<SortingState>(
    initialSort
      ? [{ id: initialSort.key, desc: initialSort.dir === 'desc' }]
      : [],
  );
  const effectiveSorting: SortingState = serverMode
    ? server.sort
      ? [{ id: server.sort.key, desc: server.sort.dir === 'desc' }]
      : []
    : sorting;

  // ── Pagination ──────────────────────────────────────────────────────────
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const effectivePagination: PaginationState = serverMode
    ? { pageIndex: server.page, pageSize: server.pageSize ?? pageSize }
    : pagination;

  // ── Expanded rows ───────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // ── Column resize + order from persisted state ──────────────────────────
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  // Effective column order. Pinned columns are always flushed to their edge
  // regardless of persisted state — `actions` columns shouldn't drift into the
  // middle, and a leading checkbox column shouldn't drift off-left.
  const effectiveOrder = useMemo(() => {
    const allIds = userColumns.map((c) => c.key);
    const leftPinned = userColumns
      .filter((c) => c.pinned === 'left')
      .map((c) => c.key);
    const rightPinned = userColumns
      .filter((c) => c.pinned === true || c.pinned === 'right')
      .map((c) => c.key);
    const isPinned = new Set([...leftPinned, ...rightPinned]);
    const persistedNonPinned = persisted.order.filter(
      (k) => allIds.includes(k) && !isPinned.has(k),
    );
    const seen = new Set(persistedNonPinned);
    const trailing = allIds.filter((k) => !seen.has(k) && !isPinned.has(k));
    return [...leftPinned, ...persistedNonPinned, ...trailing, ...rightPinned];
  }, [userColumns, persisted.order]);

  const table = useReactTable<T>({
    data,
    columns: columnDefs,
    state: {
      sorting: effectiveSorting,
      globalFilter: activeQuery,
      pagination: effectivePagination,
      expanded,
      columnSizing: persisted.widths,
      columnOrder: effectiveOrder,
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: resizableColumns,
    manualSorting: serverMode,
    manualPagination: serverMode,
    manualFiltering: serverMode,
    pageCount: serverMode ? Math.max(1, server.pageCount) : undefined,
    getRowId: (row) => rowKey(row),
    onSortingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(effectiveSorting) : updater;
      if (serverMode) {
        const head = next[0];
        server.onSortChange?.(
          head ? { key: head.id, dir: head.desc ? 'desc' : 'asc' } : null,
        );
      } else {
        setSorting(next);
      }
    },
    onGlobalFilterChange: (updater) => {
      const value =
        typeof updater === 'function' ? updater(activeQuery) : updater;
      if (serverMode) {
        server.onQueryChange?.(value ?? '');
      } else {
        setGlobalFilter(value ?? '');
        setPagination((p) => ({ ...p, pageIndex: 0 }));
      }
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(effectivePagination) : updater;
      if (serverMode) {
        if (next.pageIndex !== effectivePagination.pageIndex)
          server.onPageChange(next.pageIndex);
        if (next.pageSize !== effectivePagination.pageSize)
          server.onPageSizeChange?.(next.pageSize);
      } else {
        setPagination(next);
      }
    },
    onExpandedChange: setExpanded,
    onColumnSizingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(persisted.widths) : updater;
      writeState({ ...persisted, widths: next });
    },
    onColumnOrderChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(persisted.order) : updater;
      // Never store pinned columns in persisted order — they're appended at
      // render time so they always live at the right edge.
      const pinnedIds = new Set(
        userColumns.filter((c) => c.pinned).map((c) => c.key),
      );
      writeState({
        ...persisted,
        order: next.filter((k) => !pinnedIds.has(k)),
      });
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      if (!search || !filterValue) return true;
      return search(row.original)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: serverMode ? undefined : getSortedRowModel(),
    getFilteredRowModel: serverMode ? undefined : getFilteredRowModel(),
    getPaginationRowModel: serverMode ? undefined : getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetPageIndex: !serverMode,
  });

  // ── Layout/reset awareness ──────────────────────────────────────────────
  const hasCustomLayout =
    persisted.order.length > 0 || Object.keys(persisted.widths).length > 0;
  const resetTableLayout = () => writeState(EMPTY_STATE);

  // ── Reorder columns via HTML5 drag-and-drop on header cells ─────────────
  const reorderColumns = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const pinned = new Set(
      userColumns.filter((c) => c.pinned).map((c) => c.key),
    );
    if (pinned.has(fromKey) || pinned.has(toKey)) return;
    // Persisted order tracks ONLY non-pinned columns — pinned ones are always
    // appended at render time so they stay at the right edge.
    const nonPinnedIds = userColumns.filter((c) => !c.pinned).map((c) => c.key);
    const base = persisted.order.length
      ? persisted.order.filter((k) => nonPinnedIds.includes(k))
      : nonPinnedIds;
    const from = base.indexOf(fromKey);
    const to = base.indexOf(toKey);
    if (from < 0 || to < 0) return;
    const next = [...base];
    next.splice(from, 1);
    next.splice(to, 0, fromKey);
    for (const id of nonPinnedIds) if (!next.includes(id)) next.push(id);
    writeState({ ...persisted, order: next });
  };

  // ── Page / row counts (server-aware) ────────────────────────────────────
  const headerGroups = table.getHeaderGroups();
  const rowModel = table.getRowModel();
  const rows = rowModel.rows;
  const total = serverMode
    ? server.total
    : table.getPrePaginationRowModel().rows.length;
  const pageCount = serverMode
    ? Math.max(1, server.pageCount)
    : table.getPageCount();
  const current = effectivePagination.pageIndex;
  const start = total === 0 ? 0 : current * effectivePagination.pageSize;
  const visibleCount = serverMode ? data.length : rows.length;
  const colSpan =
    table.getVisibleLeafColumns().length + (renderExpanded ? 1 : 0);

  // The filter/search row lives INSIDE the table's bordered box (as a header)
  // so filters + grid read as one white card. The Reset-columns control keeps
  // a reserved slot whenever a header is shown — it toggles visibility, never
  // presence, so adjusting columns never shifts the layout.
  //
  // When rows are selected, the SAME header slot swaps to the bulk-action bar
  // (Gmail/Linear-style) rather than inserting a separate pill above the box —
  // the box and header are already there, so the swap is in-place with a locked
  // min-height: no element add/remove, minimal layout shift.
  const showResetSlot = resizableColumns || reorderableColumns;
  const selectionActive =
    !!selection && !!bulkActions && selection.selectedIds.size > 0;
  const headerVisible =
    selectionActive ||
    !!search ||
    !!toolbar ||
    (showResetSlot && hasCustomLayout);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Header slot — shared by the filter row and the bulk-action bar.
            One white card, fixed header height, in-place mode swap. */}
        {headerVisible && (
          <div
            className={cn(
              'flex min-h-[3.5rem] flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 transition-colors',
              selectionActive && 'bg-primary/10',
            )}
          >
            {selection && bulkActions && selection.selectedIds.size > 0 ? (
              <>
                <span className="text-sm font-medium text-foreground">
                  {selectionLabel
                    ? selectionLabel(selection.selectedIds.size)
                    : `${selection.selectedIds.size} selected`}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {bulkActions([...selection.selectedIds], () =>
                    selection.onChange(new Set()),
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => selection.onChange(new Set())}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground/60 transition hover:bg-secondary hover:text-foreground"
                >
                  <svg
                    className="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                  Clear
                </button>
              </>
            ) : (
              <>
                {search && (
                  <Input
                    value={activeQuery}
                    onChange={(e) => table.setGlobalFilter(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-9 w-full sm:w-64"
                  />
                )}
                {toolbar}
                {showResetSlot && (
                  <button
                    type="button"
                    onClick={resetTableLayout}
                    aria-hidden={!hasCustomLayout}
                    tabIndex={hasCustomLayout ? 0 : -1}
                    className={cn(
                      'ml-auto rounded-md border border-border px-2 py-1 text-xs text-foreground/60 transition hover:bg-secondary hover:text-foreground',
                      !hasCustomLayout && 'invisible pointer-events-none',
                    )}
                    title="Reset column widths and order"
                  >
                    Reset columns
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Desktop / tablet: the full table (horizontal scroll if needed). */}
        <div className="hidden overflow-x-auto sm:block">
          <table
            className="text-sm"
            style={{
              tableLayout: 'fixed',
              width: Math.max(table.getTotalSize(), 1),
              minWidth: '100%',
            }}
          >
            <colgroup>
              {renderExpanded && <col style={{ width: 36 }} />}
              {table.getVisibleLeafColumns().map((col) => (
                <col key={col.id} style={{ width: col.getSize() }} />
              ))}
            </colgroup>

            <thead>
              {headerGroups.map((hg) => (
                <tr
                  key={hg.id}
                  className="border-b border-border bg-secondary/40 text-left text-xs font-medium text-foreground/55"
                >
                  {renderExpanded && <th className="w-9" />}
                  {hg.headers.map((header) => {
                    const col = header.column;
                    const meta = (col.columnDef.meta ?? {}) as ColumnMeta;
                    const canSort = col.getCanSort();
                    const canResize =
                      resizableColumns && col.getCanResize() && !meta.pinned;
                    const sortDir = col.getIsSorted();
                    const draggable =
                      reorderableColumns &&
                      !meta.pinned &&
                      hg.headers.length > 1;
                    const isDrop =
                      dropTargetKey === col.id && dragKey !== col.id;
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        draggable={draggable || undefined}
                        onDragStart={
                          draggable
                            ? (e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', col.id);
                                setDragKey(col.id);
                              }
                            : undefined
                        }
                        onDragOver={
                          draggable
                            ? (e) => {
                                if (!dragKey || dragKey === col.id) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dropTargetKey !== col.id)
                                  setDropTargetKey(col.id);
                              }
                            : undefined
                        }
                        onDragLeave={
                          draggable && dropTargetKey === col.id
                            ? () => setDropTargetKey(null)
                            : undefined
                        }
                        onDrop={
                          draggable
                            ? (e) => {
                                e.preventDefault();
                                const from =
                                  e.dataTransfer.getData('text/plain') ||
                                  dragKey;
                                if (from && from !== col.id)
                                  reorderColumns(from, col.id);
                                setDragKey(null);
                                setDropTargetKey(null);
                              }
                            : undefined
                        }
                        onDragEnd={() => {
                          setDragKey(null);
                          setDropTargetKey(null);
                        }}
                        className={cn(
                          'group/th relative select-none overflow-hidden px-3 py-2 font-medium',
                          meta.align === 'right' && 'text-right',
                          meta.align === 'center' && 'text-center',
                          draggable && 'cursor-grab active:cursor-grabbing',
                          isDrop &&
                            'bg-primary/50 ring-1 ring-inset ring-primary/40',
                          dragKey === col.id && 'opacity-50',
                          meta.className,
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex max-w-full items-center gap-1 truncate align-middle',
                            canSort && 'cursor-pointer hover:text-foreground',
                          )}
                          onClick={
                            canSort ? col.getToggleSortingHandler() : undefined
                          }
                        >
                          <span className="truncate">
                            {flexRender(
                              col.columnDef.header,
                              header.getContext(),
                            )}
                          </span>
                          {sortDir && (
                            <Chevron dir={sortDir === 'asc' ? 'up' : 'down'} />
                          )}
                        </span>
                        {canResize && (
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize column"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              header.getResizeHandler()(e);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              header.getResizeHandler()(e);
                            }}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const next = { ...persisted.widths };
                              delete next[col.id];
                              writeState({ ...persisted, widths: next });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              'absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none transition-colors',
                              col.getIsResizing()
                                ? 'bg-primary/60'
                                : 'bg-transparent hover:bg-primary/40 group-hover/th:bg-border/80',
                            )}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody
              className={cn(
                'divide-y divide-border/60',
                server?.loading && 'opacity-50 transition-opacity',
              )}
            >
              {rows.map((row) => (
                <DataRow<T>
                  key={row.id}
                  row={row}
                  renderExpanded={renderExpanded}
                  colSpan={colSpan}
                />
              ))}
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
        </div>

        {/* Mobile: a stacked card per row — no horizontal scrolling. */}
        <div className="divide-y divide-border/60 sm:hidden">
          {rows.map((row) => (
            <MobileCard<T>
              key={row.id}
              row={row}
              headerById={columnHeaderById}
              renderExpanded={renderExpanded}
            />
          ))}
          {rows.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-foreground/50">
              {empty ?? 'Nothing to show.'}
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-foreground/55">
            <div className="flex items-center gap-3">
              <span className="tabular-nums">
                {start + 1}–{start + visibleCount} of {total}
              </span>
              {pageSizeOptions && pageSizeOptions.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span>Rows</span>
                  <Select
                    value={String(effectivePagination.pageSize)}
                    onValueChange={(v) => table.setPageSize(Number(v))}
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
                onClick={() => table.setPageIndex(current - 1)}
              >
                Prev
              </PagerButton>
              <PageJump
                current={current}
                pageCount={pageCount}
                disabled={!!server?.loading}
                goToPage={(p) => table.setPageIndex(p)}
              />
              <PagerButton
                disabled={current >= pageCount - 1 || !!server?.loading}
                onClick={() => table.setPageIndex(current + 1)}
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

/** A single body row + its optional expanded panel. */
function DataRow<T>({
  row,
  renderExpanded,
  colSpan,
}: {
  row: Row<T>;
  renderExpanded?: (row: T) => ReactNode;
  colSpan: number;
}) {
  const [isOpen, setOpen] = useState(false);
  return (
    <Fragment>
      <tr className="transition hover:bg-secondary/40">
        {renderExpanded && (
          <td className="pl-3">
            <button
              type="button"
              aria-label="Toggle details"
              onClick={() => setOpen((s) => !s)}
              className="rounded p-1 text-foreground/50 hover:bg-secondary hover:text-foreground"
            >
              <Chevron dir={isOpen ? 'down' : 'right'} />
            </button>
          </td>
        )}
        {row.getVisibleCells().map((cell) => {
          const meta = (cell.column.columnDef.meta ?? {}) as ColumnMeta;
          return (
            <td
              key={cell.id}
              style={{ width: cell.column.getSize() }}
              className={cn(
                'overflow-hidden px-3 py-2.5 align-middle',
                meta.align === 'right' && 'text-right',
                meta.align === 'center' && 'text-center',
                meta.className,
              )}
            >
              <div className="min-w-0 max-w-full">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            </td>
          );
        })}
      </tr>
      {renderExpanded && isOpen && (
        <tr className="bg-secondary/40">
          <td colSpan={colSpan} className="px-4 py-3">
            {renderExpanded(row.original)}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/**
 * Mobile rendering of a row: a card with a prominent primary value, any pinned
 * controls (selection checkbox / actions menu) on the same line, and the
 * remaining columns as label/value pairs. Replaces the horizontally-scrolling
 * table on phones (`sm:hidden`).
 */
function MobileCard<T>({
  row,
  headerById,
  renderExpanded,
}: {
  row: Row<T>;
  headerById: Map<string, ReactNode>;
  renderExpanded?: (row: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const cells = row.getVisibleCells();
  const pinnedOf = (cell: (typeof cells)[number]) =>
    ((cell.column.columnDef.meta ?? {}) as ColumnMeta).pinned;
  const leftCells = cells.filter((c) => pinnedOf(c) === 'left');
  const rightCells = cells.filter(
    (c) => pinnedOf(c) === true || pinnedOf(c) === 'right',
  );
  const bodyCells = cells.filter((c) => !pinnedOf(c));
  const [primary, ...rest] = bodyCells;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2">
        {leftCells.map((cell) => (
          <div key={cell.id} className="flex-none pt-0.5">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ))}
        {primary && (
          <div className="min-w-0 flex-1 font-medium text-foreground">
            {flexRender(primary.column.columnDef.cell, primary.getContext())}
          </div>
        )}
        <div className="flex flex-none items-center gap-1">
          {rightCells.map((cell) => (
            <div key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          ))}
          {renderExpanded && (
            <button
              type="button"
              aria-label="Toggle details"
              onClick={() => setOpen((s) => !s)}
              className="rounded p-1 text-foreground/50 hover:bg-secondary hover:text-foreground"
            >
              <Chevron dir={open ? 'down' : 'right'} />
            </button>
          )}
        </div>
      </div>

      {rest.length > 0 && (
        <dl className="mt-2.5 space-y-1.5">
          {rest.map((cell) => (
            <div
              key={cell.id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <dt className="flex-none text-foreground/55">
                {headerById.get(cell.column.id)}
              </dt>
              <dd className="min-w-0 truncate text-right text-foreground/90">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {renderExpanded && open && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {renderExpanded(row.original)}
        </div>
      )}
    </div>
  );
}

/** Page indicator + jump-to-any-page input (1-based). */
function PageJump({
  current,
  pageCount,
  disabled,
  goToPage,
}: {
  current: number;
  pageCount: number;
  disabled: boolean;
  goToPage: (p: number) => void;
}) {
  const [val, setVal] = useState(String(current + 1));
  useEffect(() => setVal(String(current + 1)), [current]);
  const commit = () => {
    const n = parseInt(val, 10);
    if (!Number.isNaN(n)) goToPage(Math.min(Math.max(0, n - 1), pageCount - 1));
    else setVal(String(current + 1));
  };
  return (
    <span className="flex items-center gap-1.5 tabular-nums">
      <input
        type="number"
        min={1}
        max={pageCount}
        value={val}
        disabled={disabled}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label="Go to page"
        className="h-7 w-12 rounded border border-border bg-transparent px-1 text-center text-sm [appearance:textfield] focus:border-primary focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-muted-foreground">/ {pageCount}</span>
    </span>
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

/** The shared square checkbox used by the selection column (header + rows). */
function SelectCheckbox({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
      className={cn(
        'flex size-[18px] shrink-0 items-center justify-center rounded border-2 transition',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border hover:border-primary',
      )}
    >
      {checked && (
        <svg
          className="size-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M2.5 6.5L5 9l4.5-6" />
        </svg>
      )}
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
