import { Injectable } from '@nestjs/common';
import {
  ASSET_CLASS_LABEL,
  assetClassForType,
  liquidityForType,
  type AssetClass,
  type EstateAnalysisConfigDto,
} from '@org/dto';
import { AiService } from '../../ai/ai.service';
import { DatabaseService } from '../../database/database.service';
import { EstateVaultConfigService } from './estate-vault-config.service';
import type { ResolvedProfile } from './estate-profile.service';

type Severity = 'info' | 'warning' | 'high';

interface Slice {
  key: string;
  label: string;
  value: number;
  pct: number;
}

export interface PortfolioMetrics {
  netWorth: number;
  currency: string;
  assetCount: number;
  /** Allocation by asset type, descending. */
  byType: Slice[];
  /** Allocation by asset class (equity/debt/cash/real_estate/gold/…). */
  byClass: Slice[];
  /** Allocation by liquidity bucket (high/medium/low). */
  byLiquidity: Slice[];
  /** Coarse financial vs physical vs other split. */
  byCategory: Slice[];
  topHolding: { label: string; pct: number } | null;
  /** Sum of the top-3 type shares (concentration proxy). */
  top3Pct: number;
  /** 0–100, higher = better diversified (1 − Herfindahl index over types). */
  diversificationScore: number;
  liquidSharePct: number;
  nomineeCoveragePct: number;
  assetsWithoutNominee: number;
  /** Maturity ladder buckets (count + value). */
  maturityLadder: { bucket: string; label: string; count: number; value: number }[];
  maturingSoon: { count: number; value: number; days: number };
  /** Total life/term cover from insurance assets (sumAssured), if recorded. */
  insuranceCover: number;
  /** Gaps vs the configured ideal allocation (only when one is configured). */
  allocationGaps: { class: string; label: string; currentPct: number; targetPct: number; deltaPct: number }[];
}

export interface PortfolioAnalysis {
  metrics: PortfolioMetrics;
  summary: string;
  /** Extra wealth-planner narrative bullets (AI, grounded in the metrics). */
  plannerNotes: string[];
  risks: { title: string; detail: string; severity: Severity }[];
  suggestions: { title: string; detail: string }[];
}

export interface AssetTypeAnalysis {
  type: string;
  label: string;
  assetClass: string;
  total: number;
  currency: string;
  count: number;
  unitsTotal: number | null;
  topHoldings: { label: string; value: number; pct: number }[];
  /** Sub-allocation within the type (e.g. MF by category, property by kind). */
  subAllocation: Slice[];
  concentrationPct: number;
  withoutNominee: number;
  summary: string;
  observations: string[];
}

interface AssetRow {
  type: string;
  label: string;
  value: number;
  units: number | null;
  maturityDate: string | null;
  details: Record<string, unknown>;
  nomineeCount: number;
}

interface AiNarrative {
  summary: string;
  plannerNotes?: string[];
}

const DAY_MS = 86_400_000;

/**
 * Portfolio-level "wealth analysis" — concentration, diversification (HHI),
 * asset-class & liquidity mix, maturity ladder, succession (nominee) readiness,
 * and (when configured) gaps vs a target allocation. Everything quantitative is
 * DETERMINISTIC here and driven by the org's `EstateVaultConfig.analysis` knobs
 * (golden rule: the AI never invents figures — it only narrates them). Risks and
 * suggestions are derived deterministically so the feature has full value even
 * without an AI provider; the AI adds a summary + planner narrative on top.
 */
@Injectable()
export class PortfolioAnalysisService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: EstateVaultConfigService,
    private readonly ai: AiService,
  ) {}

  async analyze(
    profile: ResolvedProfile,
    orgId: string | null = null,
  ): Promise<PortfolioAnalysis> {
    const cfg = await this.config.resolve(orgId);
    const knobs = cfg.analysis;
    const assets = await this.loadAssets(profile);

    if (assets.length === 0) {
      return {
        metrics: this.emptyMetrics(),
        summary: 'No assets yet. Add your first asset to see a wealth analysis.',
        plannerNotes: [],
        risks: [],
        suggestions: [
          { title: 'Add your first asset', detail: 'Start with a bank account, FD, or mutual fund.' },
        ],
      };
    }

    const typeMeta = await this.typeMaps(orgId);
    const metrics = this.computeMetrics(assets, knobs, typeMeta);
    const risks = this.deriveRisks(metrics, knobs);
    const suggestions = this.deriveSuggestions(metrics, knobs);
    const narrative = await this.narrate(metrics, risks).catch(() => null);

    return {
      metrics,
      summary: narrative?.summary ?? this.fallbackSummary(metrics),
      plannerNotes: narrative?.plannerNotes ?? [],
      risks,
      suggestions,
    };
  }

  /** Focused analysis of a single asset type (e.g. all mutual funds). */
  async analyzeType(
    profile: ResolvedProfile,
    type: string,
    orgId: string | null = null,
  ): Promise<AssetTypeAnalysis> {
    const typeMeta = await this.typeMaps(orgId);
    const meta = typeMeta.get(type);
    const all = await this.loadAssets(profile);
    const rows = all.filter((a) => a.type === type);
    const total = rows.reduce((s, a) => s + a.value, 0);
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    const topHoldings = [...rows]
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((a) => ({ label: a.label, value: a.value, pct: pct(a.value) }));

    const subAllocation = this.subAllocation(type, rows, pct);
    const hhi = this.herfindahl(rows.map((a) => a.value), total);
    const unitsTotal = rows.some((a) => a.units != null)
      ? rows.reduce((s, a) => s + (a.units ?? 0), 0)
      : null;
    const withoutNominee = rows.filter((a) => a.nomineeCount === 0).length;

    const observations = this.typeObservations(type, rows, total, subAllocation);
    const base: AssetTypeAnalysis = {
      type,
      label: meta?.label ?? type,
      assetClass: meta?.assetClass ?? assetClassForType(type),
      total,
      currency: 'INR',
      count: rows.length,
      unitsTotal,
      topHoldings,
      subAllocation,
      concentrationPct: Math.round(hhi * 100),
      withoutNominee,
      summary: '',
      observations,
    };
    if (rows.length === 0) {
      return { ...base, summary: `No ${base.label.toLowerCase()} holdings yet.` };
    }
    const summary = await this.narrateType(base).catch(() => null);
    return { ...base, summary: summary ?? this.fallbackTypeSummary(base) };
  }

  // ── data ──────────────────────────────────────────────────────────────────

  private async loadAssets(profile: ResolvedProfile): Promise<AssetRow[]> {
    const rows = await this.db.asset.findMany({
      where: { profileId: profile.id, isActive: true },
      select: {
        type: true,
        label: true,
        currentValueMinor: true,
        unitsHeld: true,
        maturityDate: true,
        details: true,
        _count: { select: { nominations: true } },
      },
    });
    return rows.map((r) => ({
      type: r.type,
      label: r.label,
      value: r.currentValueMinor ? Number(r.currentValueMinor) / 100 : 0,
      units: r.unitsHeld != null ? Number(r.unitsHeld) : null,
      maturityDate: r.maturityDate ? r.maturityDate.toISOString() : null,
      details: (r.details ?? {}) as Record<string, unknown>,
      nomineeCount: r._count.nominations,
    }));
  }

  private async typeMaps(orgId: string | null) {
    const types = await this.config.assetTypes(orgId);
    return new Map(
      types.map((t) => [
        t.key,
        {
          label: t.label,
          category: t.category as string,
          assetClass: (t.assetClass ?? assetClassForType(t.key)) as AssetClass,
          liquidity: t.liquidity ?? liquidityForType(t.key),
        },
      ]),
    );
  }

  // ── metrics ─────────────────────────────────────────────────────────────

  private computeMetrics(
    assets: AssetRow[],
    knobs: EstateAnalysisConfigDto,
    typeMeta: Map<string, { label: string; category: string; assetClass: AssetClass; liquidity: 'high' | 'medium' | 'low' }>,
  ): PortfolioMetrics {
    const total = assets.reduce((s, a) => s + a.value, 0);
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    const meta = (t: string) =>
      typeMeta.get(t) ?? {
        label: t,
        category: 'other',
        assetClass: assetClassForType(t),
        liquidity: liquidityForType(t),
      };

    const sumBy = <K extends string>(
      keyOf: (a: AssetRow) => K,
      labelOf: (k: K) => string,
    ): Slice[] => {
      const m = new Map<K, number>();
      for (const a of assets) {
        const k = keyOf(a);
        if (k) m.set(k, (m.get(k) ?? 0) + a.value);
      }
      return [...m.entries()]
        .map(([key, value]) => ({ key, label: labelOf(key), value, pct: pct(value) }))
        .sort((x, y) => y.value - x.value);
    };

    const byType = sumBy((a) => a.type, (k) => meta(k).label);
    const byClass = sumBy(
      (a) => this.classOf(a, meta(a.type).assetClass),
      (k) => ASSET_CLASS_LABEL[k as AssetClass] ?? k,
    );
    const byLiquidity = sumBy(
      (a) => meta(a.type).liquidity,
      (k) => ({ high: 'High (cash-like)', medium: 'Medium', low: 'Low (locked)' }[k] ?? k),
    );
    const byCategory = sumBy((a) => meta(a.type).category, (k) =>
      ({ financial: 'Financial', physical: 'Physical', other: 'Other' }[k] ?? k),
    );

    const top3Pct = byType.slice(0, 3).reduce((s, x) => s + x.pct, 0);
    const hhi = this.herfindahl(byType.map((b) => b.value), total);
    const diversificationScore = Math.max(0, Math.round((1 - hhi) * 100));
    const liquidSharePct =
      byLiquidity.find((b) => b.key === 'high')?.pct ?? 0;

    const coveredValue = assets
      .filter((a) => a.nomineeCount > 0)
      .reduce((s, a) => s + a.value, 0);
    const nomineeCoveragePct = pct(coveredValue);
    const assetsWithoutNominee = assets.filter((a) => a.nomineeCount === 0).length;

    const { ladder, maturingSoon } = this.maturityLadder(
      assets,
      knobs.maturingWindowDays,
    );

    const insuranceCover = assets
      .filter((a) => meta(a.type).assetClass === 'insurance')
      .reduce((s, a) => s + numeric(a.details['sumAssured']), 0);

    const allocationGaps = this.allocationGaps(byClass, knobs.idealAllocation);

    return {
      netWorth: total,
      currency: 'INR',
      assetCount: assets.length,
      byType,
      byClass,
      byLiquidity,
      byCategory,
      topHolding: byType[0] ? { label: byType[0].label, pct: byType[0].pct } : null,
      top3Pct,
      diversificationScore,
      liquidSharePct,
      nomineeCoveragePct,
      assetsWithoutNominee,
      maturityLadder: ladder,
      maturingSoon,
      insuranceCover,
      allocationGaps,
    };
  }

  /** Refine an asset's class using its own details (e.g. MF debt/liquid). */
  private classOf(a: AssetRow, fallback: AssetClass): AssetClass {
    if (fallback === 'equity' && (a.type === 'mutual_fund')) {
      const cat = String(a.details['category'] ?? '').toLowerCase();
      if (cat === 'debt') return 'debt';
      if (cat === 'liquid') return 'cash';
      if (cat === 'hybrid') return 'alternative';
    }
    return fallback;
  }

  private maturityLadder(assets: AssetRow[], windowDays: number) {
    const now = Date.now();
    const buckets = [
      { bucket: 'soon', label: `Within ${windowDays} days`, max: windowDays },
      { bucket: 'year', label: `${windowDays} days – 1 year`, max: 365 },
      { bucket: 'mid', label: '1 – 3 years', max: 365 * 3 },
      { bucket: 'long', label: '3 years+', max: Infinity },
    ];
    const ladder = buckets.map((b) => ({ ...b, count: 0, value: 0 }));
    let soonCount = 0;
    let soonValue = 0;
    for (const a of assets) {
      if (!a.maturityDate) continue;
      const days = (new Date(a.maturityDate).getTime() - now) / DAY_MS;
      if (days < 0) continue;
      const idx = ladder.findIndex((b) => days <= b.max);
      const slot = ladder[idx === -1 ? ladder.length - 1 : idx];
      slot.count += 1;
      slot.value += a.value;
      if (days <= windowDays) {
        soonCount += 1;
        soonValue += a.value;
      }
    }
    return {
      ladder: ladder
        .filter((b) => b.count > 0)
        .map(({ bucket, label, count, value }) => ({ bucket, label, count, value })),
      maturingSoon: { count: soonCount, value: soonValue, days: windowDays },
    };
  }

  private allocationGaps(
    byClass: Slice[],
    ideal: Record<string, number>,
  ): PortfolioMetrics['allocationGaps'] {
    const keys = Object.keys(ideal ?? {});
    if (keys.length === 0) return [];
    const currentPctByClass = new Map(byClass.map((b) => [b.key, b.pct]));
    return keys
      .map((cls) => {
        const targetPct = Math.round(ideal[cls] ?? 0);
        const currentPct = currentPctByClass.get(cls) ?? 0;
        return {
          class: cls,
          label: ASSET_CLASS_LABEL[cls as AssetClass] ?? cls,
          currentPct,
          targetPct,
          deltaPct: currentPct - targetPct,
        };
      })
      .filter((g) => Math.abs(g.deltaPct) >= 5)
      .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  }

  private herfindahl(values: number[], total: number): number {
    if (total <= 0 || values.length === 0) return 1;
    return values.reduce((s, v) => {
      const share = v / total;
      return s + share * share;
    }, 0);
  }

  // ── deterministic risks + suggestions ────────────────────────────────────

  private deriveRisks(
    m: PortfolioMetrics,
    knobs: EstateAnalysisConfigDto,
  ): PortfolioAnalysis['risks'] {
    const risks: PortfolioAnalysis['risks'] = [];
    if (m.topHolding && m.topHolding.pct >= knobs.concentrationHighPct) {
      risks.push({
        title: 'High concentration risk',
        detail: `${m.topHolding.label} alone is ${m.topHolding.pct}% of net worth (above the ${knobs.concentrationHighPct}% threshold). A setback in this single holding would hit the whole portfolio.`,
        severity: 'high',
      });
    } else if (m.topHolding && m.topHolding.pct >= knobs.concentrationWarnPct) {
      risks.push({
        title: 'Concentration to watch',
        detail: `${m.topHolding.label} is ${m.topHolding.pct}% of net worth. Consider trimming towards the ${knobs.concentrationWarnPct}% comfort line over time.`,
        severity: 'warning',
      });
    }
    if (m.byClass.length === 1) {
      risks.push({
        title: 'Single asset class',
        detail: `The entire portfolio sits in one asset class (${m.byClass[0].label}). There is no diversification across classes to cushion a downturn.`,
        severity: 'high',
      });
    } else if (m.diversificationScore < 35) {
      risks.push({
        title: 'Low diversification',
        detail: `Diversification score is ${m.diversificationScore}/100 — holdings are clustered. Spreading across more types/classes lowers single-point risk.`,
        severity: 'warning',
      });
    }
    if (m.nomineeCoveragePct < knobs.minNomineeCoveragePct) {
      risks.push({
        title: 'Succession gap (nominees)',
        detail: `Only ${m.nomineeCoveragePct}% of value (and ${m.assetCount - m.assetsWithoutNominee}/${m.assetCount} assets) has a nominee. ${m.assetsWithoutNominee} asset(s) have none — heirs may face delays or a succession certificate.`,
        severity: m.nomineeCoveragePct === 0 ? 'high' : 'warning',
      });
    }
    if (m.liquidSharePct < 10) {
      risks.push({
        title: 'Liquidity risk',
        detail: `Only ${m.liquidSharePct}% of net worth is in cash-like, quickly-accessible assets. An emergency need may force a distress sale of locked/illiquid holdings.`,
        severity: 'warning',
      });
    }
    for (const g of m.allocationGaps.slice(0, 2)) {
      risks.push({
        title: `${g.label} ${g.deltaPct > 0 ? 'over' : 'under'}-allocated`,
        detail: `${g.label} is ${g.currentPct}% vs a ${g.targetPct}% target (${g.deltaPct > 0 ? '+' : ''}${g.deltaPct} pts).`,
        severity: 'info',
      });
    }
    return risks;
  }

  private deriveSuggestions(
    m: PortfolioMetrics,
    knobs: EstateAnalysisConfigDto,
  ): PortfolioAnalysis['suggestions'] {
    const out: PortfolioAnalysis['suggestions'] = [];
    if (m.assetsWithoutNominee > 0) {
      out.push({
        title: 'Add nominees to every asset',
        detail: `Assign nominees to the ${m.assetsWithoutNominee} asset(s) without one — the single highest-leverage step for a smooth succession.`,
      });
    }
    if (m.byClass.length === 1 || (m.topHolding?.pct ?? 0) >= knobs.concentrationWarnPct) {
      out.push({
        title: 'Diversify across asset classes',
        detail:
          'Spread new investments beyond the dominant class (e.g. add debt/fixed income, gold, or an index fund) to reduce concentration risk.',
      });
    }
    if (m.liquidSharePct < 10) {
      out.push({
        title: 'Build a liquid emergency buffer',
        detail: `Keep ${knobs.emergencyFundMonths || 6} months of expenses in cash-like instruments (savings, liquid funds, sweep-in FD) for quick access.`,
      });
    }
    if (m.maturingSoon.count > 0) {
      out.push({
        title: 'Plan the upcoming maturities',
        detail: `${m.maturingSoon.count} asset(s) mature within ${m.maturingSoon.days} days — decide reinvestment vs. cash needs ahead of time.`,
      });
    }
    for (const g of m.allocationGaps.slice(0, 2)) {
      out.push({
        title: `${g.deltaPct > 0 ? 'Trim' : 'Top up'} ${g.label}`,
        detail: `${g.label} is ${g.currentPct}% against your ${g.targetPct}% target — ${g.deltaPct > 0 ? 'rebalance some out' : 'direct fresh money in'} to close the ${Math.abs(g.deltaPct)}-pt gap.`,
      });
    }
    return out;
  }

  // ── per-type helpers ──────────────────────────────────────────────────────

  private subAllocation(
    type: string,
    rows: AssetRow[],
    pct: (v: number) => number,
  ): Slice[] {
    const dimKey =
      type === 'mutual_fund'
        ? 'category'
        : type === 'property'
          ? 'propertyKind'
          : type === 'insurance'
            ? 'insuranceKind'
            : type === 'gold'
              ? 'form'
              : type === 'stocks' || type === 'shares' || type === 'equity'
                ? 'sector'
                : null;
    if (!dimKey) return [];
    const m = new Map<string, number>();
    for (const a of rows) {
      const k = String(a.details[dimKey] ?? 'unspecified');
      m.set(k, (m.get(k) ?? 0) + a.value);
    }
    return [...m.entries()]
      .map(([key, value]) => ({ key, label: titleCase(key), value, pct: pct(value) }))
      .sort((a, b) => b.value - a.value);
  }

  private typeObservations(
    type: string,
    rows: AssetRow[],
    total: number,
    sub: Slice[],
  ): string[] {
    const out: string[] = [];
    if (rows.length === 0) return out;
    if (sub.length === 1 && sub[0].key !== 'unspecified') {
      out.push(`All holdings are ${sub[0].label.toLowerCase()} — no spread within this type.`);
    } else if (sub.length > 1) {
      out.push(`Spread across ${sub.length} sub-categories: ${sub.slice(0, 3).map((s) => `${s.label} ${s.pct}%`).join(', ')}.`);
    }
    const top = [...rows].sort((a, b) => b.value - a.value)[0];
    if (top && total > 0) {
      const topPct = Math.round((top.value / total) * 100);
      if (topPct >= 50) out.push(`${top.label} is ${topPct}% of this bucket — concentrated within the type.`);
    }
    if (type === 'mutual_fund') {
      const invested = rows.reduce((s, a) => s + numeric(a.details['investedAmount']), 0);
      if (invested > 0 && total > 0) {
        const gain = Math.round(((total - invested) / invested) * 100);
        out.push(`Unrealised return on recorded cost ≈ ${gain >= 0 ? '+' : ''}${gain}% (current ₹${Math.round(total).toLocaleString('en-IN')} vs invested ₹${Math.round(invested).toLocaleString('en-IN')}).`);
      }
    }
    const noNominee = rows.filter((a) => a.nomineeCount === 0).length;
    if (noNominee > 0) out.push(`${noNominee} of ${rows.length} have no nominee.`);
    return out;
  }

  // ── AI narration (grounded; figures never invented) ──────────────────────

  private async narrate(
    m: PortfolioMetrics,
    risks: PortfolioAnalysis['risks'],
  ): Promise<AiNarrative> {
    const facts = [
      `Net worth ₹${Math.round(m.netWorth).toLocaleString('en-IN')} across ${m.assetCount} assets.`,
      `By class: ${m.byClass.map((c) => `${c.label} ${c.pct}%`).join(', ')}.`,
      `By type: ${m.byType.map((c) => `${c.label} ${c.pct}%`).join(', ')}.`,
      `Liquidity: ${m.byLiquidity.map((c) => `${c.label} ${c.pct}%`).join(', ')}.`,
      `Diversification score ${m.diversificationScore}/100; top holding ${m.topHolding?.label ?? '—'} ${m.topHolding?.pct ?? 0}%; top-3 ${m.top3Pct}%.`,
      `Nominee coverage ${m.nomineeCoveragePct}% of value; ${m.assetsWithoutNominee} asset(s) without a nominee.`,
      `${m.maturingSoon.count} asset(s) mature within ${m.maturingSoon.days} days.`,
      m.insuranceCover > 0 ? `Insurance cover recorded ₹${Math.round(m.insuranceCover).toLocaleString('en-IN')}.` : '',
      `Deterministic risks already flagged: ${risks.map((r) => r.title).join('; ') || 'none'}.`,
    ]
      .filter(Boolean)
      .join('\n');

    const system = [
      'You are a careful wealth-planning assistant for an Indian individual reviewing their own net worth.',
      'Use ONLY the metrics provided — never invent or recompute figures, never quote a number not given.',
      'The risks/suggestions are already computed deterministically; do NOT repeat them verbatim.',
      'Write a crisp planner-style summary and a few sharp, non-obvious planner notes (tax-wrapper hygiene, rebalancing cadence, succession, goal-bucketing). India context (₹, EPF/PPF/NPS, nominee≠heir).',
      'This is general organisation guidance, NOT advice to buy/sell specific securities. Return strictly via the schema.',
    ].join('\n');

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: { type: 'string', description: '3–5 sentence planner overview of the portfolio.' },
        plannerNotes: {
          type: 'array',
          description: '3–6 short, specific, non-obvious planner insights.',
          items: { type: 'string' },
        },
      },
    } as unknown as Parameters<AiService['extract']>[1];

    const instruction = `Analyse this net-worth snapshot. Write a planner summary + planner notes.\n\nMetrics:\n${facts}`;
    const { data } = await this.ai.extract<AiNarrative>(
      [{ kind: 'text', text: instruction }],
      schema,
      { systemPrompt: system, schemaName: 'portfolio_analysis', instruction },
    );
    return data;
  }

  private async narrateType(a: AssetTypeAnalysis): Promise<string> {
    const facts = [
      `${a.label}: ₹${Math.round(a.total).toLocaleString('en-IN')} across ${a.count} holding(s).`,
      a.subAllocation.length ? `Sub-allocation: ${a.subAllocation.map((s) => `${s.label} ${s.pct}%`).join(', ')}.` : '',
      a.topHoldings.length ? `Top: ${a.topHoldings.slice(0, 3).map((h) => `${h.label} ${h.pct}%`).join(', ')}.` : '',
      a.observations.join(' '),
    ]
      .filter(Boolean)
      .join('\n');
    const system =
      'You are a wealth-planning assistant. In 2–3 sentences, summarise this single asset-type bucket for an Indian investor, using ONLY the figures given. No buy/sell advice on specific securities. Plain text only.';
    const { data } = await this.ai.extract<{ summary: string }>(
      [{ kind: 'text', text: `Summarise this asset bucket:\n${facts}` }],
      {
        type: 'object',
        additionalProperties: false,
        properties: { summary: { type: 'string' } },
      } as unknown as Parameters<AiService['extract']>[1],
      { systemPrompt: system, schemaName: 'asset_type_analysis', instruction: facts },
    );
    return data.summary;
  }

  // ── fallbacks (no AI) ────────────────────────────────────────────────────

  private fallbackSummary(m: PortfolioMetrics): string {
    const cls = m.byClass[0];
    return `Net worth is ₹${Math.round(m.netWorth).toLocaleString('en-IN')} across ${m.assetCount} assets, led by ${cls?.label ?? '—'} (${cls?.pct ?? 0}%). Diversification score ${m.diversificationScore}/100, ${m.liquidSharePct}% liquid, and ${m.nomineeCoveragePct}% of value has a nominee.`;
  }

  private fallbackTypeSummary(a: AssetTypeAnalysis): string {
    return `${a.label}: ₹${Math.round(a.total).toLocaleString('en-IN')} across ${a.count} holding(s)${a.subAllocation.length ? `, led by ${a.subAllocation[0].label} (${a.subAllocation[0].pct}%)` : ''}.`;
  }

  private emptyMetrics(): PortfolioMetrics {
    return {
      netWorth: 0,
      currency: 'INR',
      assetCount: 0,
      byType: [],
      byClass: [],
      byLiquidity: [],
      byCategory: [],
      topHolding: null,
      top3Pct: 0,
      diversificationScore: 0,
      liquidSharePct: 0,
      nomineeCoveragePct: 0,
      assetsWithoutNominee: 0,
      maturityLadder: [],
      maturingSoon: { count: 0, value: 0, days: 90 },
      insuranceCover: 0,
      allocationGaps: [],
    };
  }
}

function numeric(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
