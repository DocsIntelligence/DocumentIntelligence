import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, Spinner } from '@org/ui';
import { APP_ENV } from '../../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

type Scope =
  | { kind: 'batch'; id: string }
  | { kind: 'source'; id: string }
  | { kind: 'pipeline-run'; id: string }
  | { kind: 'document'; id: string }
  | { kind: 'user'; id: string }
  | { kind: 'org'; id: string };

interface Summary {
  totals: {
    calls: number;
    successCalls: number;
    errorCalls: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    costUsd: number;
    averageDurationMs: number;
  };
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
}

function fmtUsd(n: number) {
  if (n === 0) return '$0';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
function fmtN(n: number) {
  return n.toLocaleString();
}

/**
 * Compact AI-usage card — drops into any "subject" page (batch detail / source
 * analyze / drafting document) to show the tokens + cost attributed to that
 * subject. Pulls from a single denormalised ledger, so adding it costs one
 * indexed query (no extra writes, no joins).
 */
export function AiUsageSummary({
  scope,
  title,
  className,
}: {
  scope: Scope;
  title?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE_URL}/admin/ai-usage/by-${scope.kind}/${scope.id}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setSummary(data as Summary);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope.kind, scope.id]);

  if (loading) {
    return (
      <Card className={`rounded-xl p-5 flex items-center gap-3 ${className ?? ''}`}>
        <Spinner className="size-4" />
        <span className="text-sm text-foreground/60">
          {t('aiUsage.loading', 'Loading AI usage…')}
        </span>
      </Card>
    );
  }

  if (!summary || summary.totals.calls === 0) {
    return (
      <Card className={`rounded-xl p-5 ${className ?? ''}`}>
        <h3 className="font-medium text-foreground text-sm">
          {title ?? t('aiUsage.miniTitle', 'AI usage')}
        </h3>
        <p className="text-xs text-foreground/50 mt-1">
          {t('aiUsage.noneYet', 'No AI calls attributed to this yet.')}
        </p>
      </Card>
    );
  }

  return (
    <Card className={`rounded-xl p-5 ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-foreground text-sm">
          {title ?? t('aiUsage.miniTitle', 'AI usage')}
        </h3>
        <Link
          to={`/config/ai-usage?${scope.kind}=${scope.id}`}
          className="text-xs text-primary hover:underline"
        >
          {t('aiUsage.viewAll', 'View all →')}
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Kpi
          label={t('aiUsage.kpiCalls', 'Calls')}
          value={fmtN(summary.totals.calls)}
          sub={
            summary.totals.errorCalls > 0
              ? `${summary.totals.errorCalls} err`
              : 'all ok'
          }
        />
        <Kpi
          label={t('aiUsage.kpiCost', 'Cost')}
          value={fmtUsd(summary.totals.costUsd)}
        />
        <Kpi
          label={t('aiUsage.kpiTokens', 'Tokens')}
          value={fmtN(summary.totals.totalTokens)}
          sub={`${fmtN(summary.totals.inputTokens)} in · ${fmtN(summary.totals.outputTokens)} out`}
        />
        <Kpi
          label={t('aiUsage.kpiAvgLatency', 'Avg latency')}
          value={
            summary.totals.averageDurationMs < 1000
              ? `${summary.totals.averageDurationMs} ms`
              : `${(summary.totals.averageDurationMs / 1000).toFixed(2)} s`
          }
        />
      </div>

      {summary.perModel.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-foreground/50 mb-1.5">
            {t('aiUsage.byModel', 'By model')}
          </p>
          <ul className="space-y-1 text-xs">
            {summary.perModel.slice(0, 5).map((m) => (
              <li
                key={`${m.provider}/${m.model}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="font-mono text-foreground/80 truncate">
                  {m.model}
                </span>
                <span className="tabular-nums text-foreground/70 whitespace-nowrap">
                  {fmtN(m.tokens)} tok · {fmtUsd(m.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/50">
        {label}
      </p>
      <p className="text-base font-semibold text-foreground mt-0.5 tabular-nums">
        {value}
      </p>
      {sub && <p className="text-[10px] text-foreground/45 mt-0.5">{sub}</p>}
    </div>
  );
}

export default AiUsageSummary;
