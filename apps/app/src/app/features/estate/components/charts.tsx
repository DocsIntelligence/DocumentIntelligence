import { cn } from '@org/utils';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../queries';

/**
 * Dependency-free, theme-driven chart primitives for the Estate dashboard +
 * report. Colours are pulled from the central theme via CSS custom properties
 * (`--color-*`), so they re-skin with the rest of the app. All amount labels
 * respect the active profile's `masked` toggle.
 */

/** Slice/series colours, in priority order. CSS vars registered in styles.css. */
export const CHART_COLORS = [
  '--color-primary',
  '--color-info',
  '--color-success',
  '--color-warning',
  '--color-error',
  '--color-primary-accent',
  '--color-secondary-foreground',
] as const;

export const colorAt = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

/** Compact Indian-format money for axis/inline labels (₹1.2 Cr, ₹3.4 L…). */
export function compactMoney(value: number, currency = 'INR', masked = false) {
  if (masked) return '••••';
  const sym = currency === 'INR' ? '₹' : `${currency} `;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  let body: string;
  if (abs >= 1e7) body = `${(abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1)} Cr`;
  else if (abs >= 1e5) body = `${(abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1)} L`;
  else if (abs >= 1e3) body = `${(abs / 1e3).toFixed(0)}K`;
  else body = String(Math.round(abs));
  return `${sign}${sym}${body}`;
}

// ── Donut ──────────────────────────────────────────────────────────────────

export interface DonutSlice {
  label: string;
  value: number;
  color: string; // a CSS var name from CHART_COLORS
}

export function DonutChart({
  slices,
  size = 168,
  thickness = 22,
  centerLabel,
  centerSub,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-border/60"
        />
        {total > 0 &&
          slices.map((s, i) => {
            const len = (Math.max(0, s.value) / total) * circumference;
            const offset = -acc;
            acc += len;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                strokeWidth={thickness}
                stroke={`var(${s.color})`}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={offset}
              />
            );
          })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerLabel && (
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {centerLabel}
            </span>
          )}
          {centerSub && (
            <span className="text-xs text-foreground/55">{centerSub}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** A labelled legend for a donut/series, with optional share-of-total %. */
export function ChartLegend({
  items,
  total,
  currency,
  masked,
}: {
  items: DonutSlice[];
  total?: number;
  currency?: string;
  masked?: boolean;
}) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 flex-none rounded-full"
            style={{ backgroundColor: `var(${it.color})` }}
          />
          <span className="min-w-0 flex-1 truncate text-foreground/75">
            {it.label}
          </span>
          <span className="flex-none tabular-nums text-foreground/90">
            {formatMoney(it.value, currency, masked)}
          </span>
          {total && total > 0 && (
            <span className="w-9 flex-none text-right text-xs tabular-nums text-foreground/45">
              {Math.round((it.value / total) * 100)}%
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Horizontal bars ──────────────────────────────────────────────────────────

export function HBarList({
  rows,
  currency,
  masked,
}: {
  rows: DonutSlice[];
  currency?: string;
  masked?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground/75">
              {r.label}
            </span>
            <span className="flex-none tabular-nums text-foreground/90">
              {formatMoney(r.value, currency, masked)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (r.value / max) * 100)}%`,
                backgroundColor: `var(${r.color})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Trend (net worth over time) ──────────────────────────────────────────────

export interface TrendPoint {
  asOf: string;
  value: number;
}

export function TrendChart({
  points,
  height = 150,
  currency,
  masked,
}: {
  points: TrendPoint[];
  height?: number;
  currency?: string;
  masked?: boolean;
}) {
  const { t } = useTranslation();
  const gradientId = useId();

  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border text-sm text-foreground/50"
        style={{ height }}
      >
        {t('estate.notEnoughHistory', 'Not enough history yet — check back as your values change.')}
      </div>
    );
  }

  const W = 600;
  const H = height;
  const pad = 6;
  const ys = points.map((p) => p.value);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - pad - ((v - minY) / span) * (H - 2 * pad);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const delta = last - first;
  const pct = first !== 0 ? (delta / Math.abs(first)) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-foreground/55">
          {compactMoney(minY, currency, masked)} – {compactMoney(maxY, currency, masked)}
        </span>
        {!masked && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-sm font-medium tabular-nums',
              delta >= 0 ? 'text-success' : 'text-error',
            )}
          >
            {delta >= 0 ? '▲' : '▼'} {compactMoney(Math.abs(delta), currency)} (
            {pct >= 0 ? '+' : ''}
            {pct.toFixed(1)}%)
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
