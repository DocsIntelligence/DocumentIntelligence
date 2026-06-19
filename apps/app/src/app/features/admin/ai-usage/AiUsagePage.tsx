import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  type DataTableColumn,
} from '@org/ui';
import { selectUser, useAppSelector } from '@org/store';
import { APP_ENV } from '../../../../config';
import { PageHeader } from '../../../components/page-header';
import { useBatches } from '../../intelligence/queries';

const API_BASE_URL = APP_ENV.apiUrl;

interface Summary {
  totals: {
    calls: number;
    successCalls: number;
    errorCalls: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    costUsd: number;
    averageDurationMs: number;
  };
  daily: Array<{
    day: string;
    calls: number;
    tokens: number;
    costUsd: number;
    errors: number;
  }>;
  perOperation: Array<{
    operation: string;
    calls: number;
    tokens: number;
    costUsd: number;
  }>;
  perModel: Array<{
    provider: string;
    model: string;
    calls: number;
    tokens: number;
    costUsd: number;
  }>;
  perProvider: Array<{
    provider: string;
    calls: number;
    tokens: number;
    costUsd: number;
  }>;
  latency: { p50: number; p95: number; p99: number };
}

interface UsageRow {
  id: string;
  createdAt: string;
  userId: string | null;
  orgId: string | null;
  operation: string;
  provider: string;
  model: string;
  documentId: string | null;
  sourceDocumentId: string | null;
  pipelineRunId: string | null;
  batchId: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  status: string;
  attempt: number;
  finishReason: string | null;
  errorMessage: string | null;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> =
  {
    success: 'success',
    error: 'error',
    timeout: 'error',
    rate_limited: 'warning',
    cancelled: 'info',
    partial: 'warning',
  };

const RANGES: Array<{ label: string; days: number }> = [
  { label: 'Last 24h', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function fmtUsd(n: number) {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
function fmtN(n: number) {
  return n.toLocaleString();
}
function fmtMs(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function AiUsagePage() {
  const { t } = useTranslation();
  const currentUser = useAppSelector(selectUser);
  const [searchParams, setSearchParams] = useSearchParams();

  const [days, setDays] = useState(30);
  const [scope, setScope] = useState<'workspace' | 'me'>('workspace');
  const [operation, setOperation] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  const [model, setModel] = useState<string>('');
  // Seed scope-bound filters from the URL once on mount so links from the
  // AiUsageSummary "View all →" buttons actually pre-filter the page.
  const [batchId, setBatchId] = useState<string>(
    () => searchParams.get('batch') ?? '',
  );
  const [sourceDocumentId, setSourceDocumentId] = useState<string>(
    () => searchParams.get('source') ?? '',
  );
  const [pipelineRunId, setPipelineRunId] = useState<string>(
    () => searchParams.get('pipeline-run') ?? '',
  );
  const [documentId, setDocumentId] = useState<string>(
    () => searchParams.get('document') ?? '',
  );

  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [query, setQuery] = useState('');
  // Debounced search — typing should NOT refetch on every keystroke, otherwise
  // the input feels laggy on a slow backend.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(handle);
  }, [query]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // List of batches for the Batch filter dropdown. Read-only and small —
  // the user's own batches, server-paginated to ~50 most recent.
  const batchesQuery = useBatches({ pageSize: 100 });
  const batchOptions = batchesQuery.data?.items ?? [];

  // Sync the active scope filter back into the URL so a shared link survives
  // a refresh. Single-source-of-truth: state → URL.
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const set = (k: string, v: string) => {
      if (v) params.set(k, v);
      else params.delete(k);
    };
    set('batch', batchId);
    set('source', sourceDocumentId);
    set('pipeline-run', pipelineRunId);
    set('document', documentId);
    setSearchParams(params, { replace: true });
    // searchParams is intentionally excluded — we only push, never react.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, sourceDocumentId, pipelineRunId, documentId]);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  useEffect(() => {
    setPage(0);
  }, [
    scope,
    operation,
    provider,
    model,
    days,
    debouncedQuery,
    batchId,
    sourceDocumentId,
    pipelineRunId,
    documentId,
    pageSize,
  ]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    const base =
      scope === 'me' ? `${API_BASE_URL}/me` : `${API_BASE_URL}/admin`;
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (operation) params.set('operation', operation);
    if (provider) params.set('provider', provider);
    if (model) params.set('model', model);
    if (batchId) params.set('batchId', batchId);
    if (sourceDocumentId) params.set('sourceDocumentId', sourceDocumentId);
    if (pipelineRunId) params.set('pipelineRunId', pipelineRunId);
    if (documentId) params.set('documentId', documentId);
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    const listParams = new URLSearchParams(params);
    listParams.set('page', String(page));
    listParams.set('pageSize', String(pageSize));

    Promise.all([
      fetch(`${base}/ai-usage/summary?${params.toString()}`, {
        credentials: 'include',
      }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      ),
      fetch(`${base}/ai-usage?${listParams.toString()}`, {
        credentials: 'include',
      }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      ),
    ])
      .then(([s, l]) => {
        if (cancelled) return;
        setSummary(s as Summary);
        setRows((l.items ?? []) as UsageRow[]);
        setTotal(l.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          // Don't blow away the Input + filters when a fetch fails — just
          // null out the data so the empty-state cards show, but the user
          // can still type / change filters to retry.
          setSummary(null);
          setRows([]);
          setTotal(0);
          toast.error(t('aiUsage.loadFailed', 'Failed to load AI usage'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    scope,
    range.from,
    range.to,
    operation,
    provider,
    model,
    batchId,
    sourceDocumentId,
    pipelineRunId,
    documentId,
    debouncedQuery,
    page,
    pageSize,
    t,
  ]);

  const columns: DataTableColumn<UsageRow>[] = [
    {
      key: 'createdAt',
      header: t('aiUsage.colWhen', 'When'),
      cell: (r) => (
        <span className="text-xs text-foreground/60">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'operation',
      header: t('aiUsage.colOp', 'Op'),
      cell: (r) => (
        <Badge variant="info" className="capitalize">
          {r.operation}
        </Badge>
      ),
    },
    {
      key: 'model',
      header: t('aiUsage.colModel', 'Model'),
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-foreground">{r.model}</div>
          <div className="text-xs text-foreground/50">{r.provider}</div>
        </div>
      ),
    },
    {
      key: 'tokens',
      header: t('aiUsage.colTokens', 'Tokens'),
      sortValue: (r) => r.totalTokens,
      cell: (r) => (
        <div className="text-sm tabular-nums">
          <div className="text-foreground">{fmtN(r.totalTokens)}</div>
          <div className="text-xs text-foreground/50">
            {fmtN(r.inputTokens)} in · {fmtN(r.outputTokens)} out
          </div>
        </div>
      ),
    },
    {
      key: 'cost',
      header: t('aiUsage.colCost', 'Cost'),
      sortValue: (r) => r.estimatedCostUsd,
      cell: (r) => (
        <span className="text-sm tabular-nums text-foreground">
          {fmtUsd(r.estimatedCostUsd)}
        </span>
      ),
    },
    {
      key: 'duration',
      header: t('aiUsage.colDuration', 'Duration'),
      sortValue: (r) => r.durationMs,
      cell: (r) => (
        <span className="text-sm tabular-nums text-foreground/70">
          {fmtMs(r.durationMs)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('aiUsage.colStatus', 'Status'),
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant={STATUS_VARIANT[r.status] ?? 'info'} className="w-fit">
            {r.status}
          </Badge>
          {r.attempt > 1 && (
            <span className="text-[10px] text-foreground/40">
              attempt {r.attempt}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'entity',
      header: t('aiUsage.colEntity', 'Entity'),
      cell: (r) => {
        const link =
          (r.documentId && {
            to: `/documents/${r.documentId}`,
            label: 'doc',
          }) ||
          (r.sourceDocumentId && {
            to: `/analyze/${r.sourceDocumentId}`,
            label: 'source',
          }) ||
          (r.batchId && { to: `/batches/${r.batchId}`, label: 'batch' });
        if (!link) return <span className="text-xs text-foreground/30">—</span>;
        return (
          <Link to={link.to} className="text-xs text-primary hover:underline">
            {link.label}
          </Link>
        );
      },
    },
  ];

  if (!currentUser) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={false}
        title={t('aiUsage.title', 'AI usage')}
        subtitle={t(
          'aiUsage.subtitle',
          'Every AI / LLM call across the platform — tokens, latency and cost, sliced by user, model, operation and document.',
        )}
        actions={
          <>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as 'workspace' | 'me')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace">
                  {t('aiUsage.scopeWorkspace', 'Workspace')}
                </SelectItem>
                <SelectItem value="me">
                  {t('aiUsage.scopeMine', 'My calls only')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(days)}
              onValueChange={(v) => setDays(Number(v))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.days} value={String(r.days)}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Active scope-filter pills — show what the URL pre-filtered to, with
          one-click clear. */}
      {(batchId || sourceDocumentId || pipelineRunId || documentId) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs">
          <span className="text-foreground/60">
            {t('aiUsage.scopedTo', 'Scoped to')}:
          </span>
          {batchId && (
            <ScopePill
              label={t('aiUsage.scopeBatch', 'Batch')}
              value={
                batchOptions.find((b) => b.id === batchId)?.name ?? batchId
              }
              onClear={() => setBatchId('')}
            />
          )}
          {sourceDocumentId && (
            <ScopePill
              label={t('aiUsage.scopeSource', 'Source')}
              value={sourceDocumentId}
              onClear={() => setSourceDocumentId('')}
            />
          )}
          {pipelineRunId && (
            <ScopePill
              label={t('aiUsage.scopePipelineRun', 'Pipeline run')}
              value={pipelineRunId}
              onClear={() => setPipelineRunId('')}
            />
          )}
          {documentId && (
            <ScopePill
              label={t('aiUsage.scopeDocument', 'Document')}
              value={documentId}
              onClear={() => setDocumentId('')}
            />
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {!summary || summary.totals.calls === 0 ? (
            <Card className="rounded-xl p-5">
              <p className="text-sm text-foreground/60">
                {t(
                  'aiUsage.empty',
                  'No AI calls match the current filter window.',
                )}
              </p>
            </Card>
          ) : (
            <>
              {/* KPI tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiTile
                  label={t('aiUsage.kpiCalls', 'Calls')}
                  value={fmtN(summary.totals.calls)}
                  sub={`${fmtN(summary.totals.successCalls)} ok · ${fmtN(summary.totals.errorCalls)} err`}
                />
                <KpiTile
                  label={t('aiUsage.kpiCost', 'Est. cost')}
                  value={fmtUsd(summary.totals.costUsd)}
                  sub={`${fmtN(summary.totals.totalTokens)} tokens`}
                />
                <KpiTile
                  label={t('aiUsage.kpiInput', 'Input tokens')}
                  value={fmtN(summary.totals.inputTokens)}
                  sub={`${fmtN(summary.totals.cachedInputTokens)} cached`}
                />
                <KpiTile
                  label={t('aiUsage.kpiOutput', 'Output tokens')}
                  value={fmtN(summary.totals.outputTokens)}
                  sub={
                    summary.totals.reasoningTokens > 0
                      ? `${fmtN(summary.totals.reasoningTokens)} reasoning`
                      : ''
                  }
                />
                <KpiTile
                  label={t('aiUsage.kpiAvg', 'Avg duration')}
                  value={fmtMs(summary.totals.averageDurationMs)}
                  sub={`p95 ${fmtMs(summary.latency.p95)} · p99 ${fmtMs(summary.latency.p99)}`}
                />
                <KpiTile
                  label={t('aiUsage.kpiErrors', 'Error rate')}
                  value={
                    summary.totals.calls
                      ? `${((summary.totals.errorCalls / summary.totals.calls) * 100).toFixed(1)}%`
                      : '0%'
                  }
                  sub={`${fmtN(summary.totals.errorCalls)} failed`}
                />
              </div>

              {/* Sparkline (per-day calls) + breakdown cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="rounded-xl p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-foreground">
                      {t('aiUsage.dailyTitle', 'Daily volume')}
                    </h3>
                    {refreshing && <Spinner className="size-4" />}
                  </div>
                  <DailyBars daily={summary.daily} />
                </Card>

                <Card className="rounded-xl p-5">
                  <h3 className="font-medium text-foreground mb-3">
                    {t('aiUsage.providersTitle', 'Providers')}
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {summary.perProvider.length === 0 && (
                      <li className="text-foreground/40">—</li>
                    )}
                    {summary.perProvider.map((p) => (
                      <li
                        key={p.provider}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="font-mono text-xs text-foreground/80">
                          {p.provider}
                        </span>
                        <span className="tabular-nums text-foreground">
                          {fmtUsd(p.costUsd)}{' '}
                          <span className="text-foreground/40">
                            · {fmtN(p.calls)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="rounded-xl p-5">
                  <h3 className="font-medium text-foreground mb-3">
                    {t('aiUsage.byModelTitle', 'By model')}
                  </h3>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-foreground/50 border-b border-border/40">
                      <tr>
                        <th className="text-left py-1">Model</th>
                        <th className="text-right py-1">Calls</th>
                        <th className="text-right py-1">Tokens</th>
                        <th className="text-right py-1">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.perModel.map((m) => (
                        <tr
                          key={`${m.provider}/${m.model}`}
                          className="border-b border-border/20 last:border-0"
                        >
                          <td className="py-1.5">
                            <div className="font-mono text-xs text-foreground">
                              {m.model}
                            </div>
                            <div className="text-[10px] text-foreground/50">
                              {m.provider}
                            </div>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {fmtN(m.calls)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {fmtN(m.tokens)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {fmtUsd(m.costUsd)}
                          </td>
                        </tr>
                      ))}
                      {summary.perModel.length === 0 && (
                        <tr>
                          <td className="py-3 text-foreground/40" colSpan={4}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>

                <Card className="rounded-xl p-5">
                  <h3 className="font-medium text-foreground mb-3">
                    {t('aiUsage.byOpTitle', 'By operation')}
                  </h3>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-foreground/50 border-b border-border/40">
                      <tr>
                        <th className="text-left py-1">Operation</th>
                        <th className="text-right py-1">Calls</th>
                        <th className="text-right py-1">Tokens</th>
                        <th className="text-right py-1">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.perOperation.map((o) => (
                        <tr
                          key={o.operation}
                          className="border-b border-border/20 last:border-0"
                        >
                          <td className="py-1.5 capitalize">{o.operation}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            {fmtN(o.calls)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {fmtN(o.tokens)}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {fmtUsd(o.costUsd)}
                          </td>
                        </tr>
                      ))}
                      {summary.perOperation.length === 0 && (
                        <tr>
                          <td className="py-3 text-foreground/40" colSpan={4}>
                            —
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}

          {/* Filters + recent calls — always shown so users can adjust filters
              even when the current window has no data. */}
          <Card className="rounded-xl p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <h3 className="font-medium text-foreground">
                {t('aiUsage.recentTitle', 'Recent calls')}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder={t(
                    'aiUsage.searchPlaceholder',
                    'Search model / feature / error…',
                  )}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-[260px]"
                />
                <Select
                  value={operation || '__all'}
                  onValueChange={(v) => setOperation(v === '__all' ? '' : v)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Op" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All operations</SelectItem>
                    {(summary?.perOperation ?? []).map((o) => (
                      <SelectItem key={o.operation} value={o.operation}>
                        {o.operation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={provider || '__all'}
                  onValueChange={(v) => setProvider(v === '__all' ? '' : v)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All providers</SelectItem>
                    {(summary?.perProvider ?? []).map((p) => (
                      <SelectItem key={p.provider} value={p.provider}>
                        {p.provider}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={model || '__all'}
                  onValueChange={(v) => setModel(v === '__all' ? '' : v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All models</SelectItem>
                    {(summary?.perModel ?? []).map((m) => (
                      <SelectItem
                        key={`${m.provider}/${m.model}`}
                        value={m.model}
                      >
                        {m.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={batchId || '__all'}
                  onValueChange={(v) => setBatchId(v === '__all' ? '' : v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue
                      placeholder={t('aiUsage.filterBatch', 'Batch')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">
                      {t('aiUsage.allBatches', 'All batches')}
                    </SelectItem>
                    {batchOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name ?? b.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(operation ||
                  provider ||
                  model ||
                  batchId ||
                  sourceDocumentId ||
                  pipelineRunId ||
                  documentId ||
                  query) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOperation('');
                      setProvider('');
                      setModel('');
                      setBatchId('');
                      setSourceDocumentId('');
                      setPipelineRunId('');
                      setDocumentId('');
                      setQuery('');
                    }}
                  >
                    {t('common.clear', 'Clear')}
                  </Button>
                )}
              </div>
            </div>

            <DataTable
              tableId="admin-ai-usage"
              columns={columns}
              data={rows}
              rowKey={(r) => r.id}
              empty={t('aiUsage.noCalls', 'No AI calls in this range.')}
              server={{
                page,
                pageCount: Math.max(1, Math.ceil(total / pageSize)),
                total,
                onPageChange: setPage,
                pageSize,
                onPageSizeChange: setPageSize,
                loading: refreshing,
              }}
              pageSizeOptions={[25, 50, 100, 200]}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function ScopePill({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
      <span className="text-foreground/55">{label}:</span>
      <span className="font-mono text-foreground/90 truncate max-w-[180px]">
        {value}
      </span>
      <button
        type="button"
        onClick={onClear}
        title="Clear"
        className="-mr-0.5 ml-0.5 text-foreground/45 hover:text-error"
      >
        ×
      </button>
    </span>
  );
}

function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="rounded-xl p-4">
      <p className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-semibold text-foreground mt-1 tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-foreground/45 mt-0.5 truncate">{sub}</p>
      )}
    </Card>
  );
}

function DailyBars({
  daily,
}: {
  daily: Array<{ day: string; calls: number; costUsd: number; errors: number }>;
}) {
  if (!daily.length) {
    return <p className="text-foreground/40 text-sm py-6">No data in range.</p>;
  }
  const max = Math.max(...daily.map((d) => d.calls), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {daily.map((d) => {
        const h = Math.max(2, Math.round((d.calls / max) * 100));
        const errorH = d.calls ? Math.round((d.errors / d.calls) * h) : 0;
        return (
          <div
            key={d.day}
            className="flex-1 group relative flex flex-col-reverse items-stretch"
            title={`${d.day} · ${d.calls} calls · ${fmtUsd(d.costUsd)} · ${d.errors} errors`}
          >
            <div
              className="bg-primary/70 rounded-sm transition-all group-hover:bg-primary"
              style={{ height: `${h}%` }}
            />
            {errorH > 0 && (
              <div
                className="bg-error/70 rounded-sm absolute bottom-0 left-0 right-0"
                style={{ height: `${errorH}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AiUsagePage;
