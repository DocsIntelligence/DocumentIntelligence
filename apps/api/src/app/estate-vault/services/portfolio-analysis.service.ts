import { Injectable } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { AssetService } from './asset.service';
import { EstateReportService } from './estate-report.service';
import type { ResolvedProfile } from './estate-profile.service';

const MATURING_WINDOW_DAYS = 90;

export interface PortfolioMetrics {
  netWorth: number;
  currency: string;
  assetCount: number;
  topHolding: { label: string; pct: number } | null;
  /** Allocation by asset type, descending, with share-of-total %. */
  concentration: { label: string; value: number; pct: number }[];
  categorySplit: { category: string; value: number; pct: number }[];
  nomineeCoveragePct: number;
  assetsWithoutNominee: number;
  maturingSoon: { count: number; days: number };
}

export interface PortfolioAnalysis {
  metrics: PortfolioMetrics;
  summary: string;
  risks: { title: string; detail: string; severity: 'info' | 'warning' | 'high' }[];
  suggestions: { title: string; detail: string }[];
}

interface AiPortfolioNarrative {
  summary: string;
  risks?: { title: string; detail: string; severity?: string }[];
  suggestions?: { title: string; detail: string }[];
}

/**
 * Portfolio-level "wealth analysis": concentration, diversification, nominee
 * coverage and liquidity/maturity gaps across the whole net worth — not a single
 * document. Metrics are computed DETERMINISTICALLY here; the AI only narrates +
 * prioritises from those numbers (golden rule: the model never invents figures).
 */
@Injectable()
export class PortfolioAnalysisService {
  constructor(
    private readonly assets: AssetService,
    private readonly report: EstateReportService,
    private readonly ai: AiService,
  ) {}

  async analyze(profile: ResolvedProfile): Promise<PortfolioAnalysis> {
    const metrics = await this.computeMetrics(profile);

    if (metrics.assetCount === 0) {
      return {
        metrics,
        summary:
          'No assets yet. Add your first asset to see a net-worth analysis.',
        risks: [],
        suggestions: [
          {
            title: 'Add your first asset',
            detail: 'Start with a bank account, FD, or mutual fund.',
          },
        ],
      };
    }

    const narrative = await this.narrate(metrics);
    const allowed = new Set(['info', 'warning', 'high']);
    return {
      metrics,
      summary: narrative.summary,
      risks: (narrative.risks ?? []).map((r) => ({
        title: r.title,
        detail: r.detail,
        severity: (allowed.has(r.severity ?? '')
          ? r.severity
          : 'info') as 'info' | 'warning' | 'high',
      })),
      suggestions: narrative.suggestions ?? [],
    };
  }

  private async computeMetrics(
    profile: ResolvedProfile,
  ): Promise<PortfolioMetrics> {
    const [nw, rep] = await Promise.all([
      this.assets.netWorth(profile),
      this.report.ownerReport(profile),
    ]);
    const total = nw.netWorth || 0;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    const concentration = nw.byType
      .map((b) => ({ label: b.label, value: b.value, pct: pct(b.value) }))
      .sort((a, b) => b.value - a.value);

    const catMap = new Map<string, number>();
    for (const b of nw.byType)
      catMap.set(b.category, (catMap.get(b.category) ?? 0) + b.value);
    const categorySplit = [...catMap.entries()]
      .map(([category, value]) => ({ category, value, pct: pct(value) }))
      .sort((a, b) => b.value - a.value);

    const coveredValue = rep.assets
      .filter((a) => a.nominees.length > 0)
      .reduce((s, a) => s + a.value, 0);
    const nomineeCoveragePct = pct(coveredValue);

    const now = Date.now();
    const horizon = now + MATURING_WINDOW_DAYS * 24 * 3600 * 1000;
    const maturingSoonCount = rep.assets.filter((a) => {
      if (!a.maturityDate) return false;
      const t = new Date(a.maturityDate).getTime();
      return t >= now && t <= horizon;
    }).length;

    return {
      netWorth: total,
      currency: nw.currency,
      assetCount: nw.assetCount,
      topHolding: concentration[0]
        ? { label: concentration[0].label, pct: concentration[0].pct }
        : null,
      concentration,
      categorySplit,
      nomineeCoveragePct,
      assetsWithoutNominee: rep.assetsWithoutNominee,
      maturingSoon: { count: maturingSoonCount, days: MATURING_WINDOW_DAYS },
    };
  }

  private async narrate(
    metrics: PortfolioMetrics,
  ): Promise<AiPortfolioNarrative> {
    const facts = [
      `Net worth: ${metrics.netWorth} ${metrics.currency} across ${metrics.assetCount} assets.`,
      `Allocation by type: ${metrics.concentration
        .map((c) => `${c.label} ${c.pct}%`)
        .join(', ')}.`,
      `By category: ${metrics.categorySplit
        .map((c) => `${c.category} ${c.pct}%`)
        .join(', ')}.`,
      metrics.topHolding
        ? `Largest single type: ${metrics.topHolding.label} at ${metrics.topHolding.pct}% of net worth.`
        : '',
      `Nominee coverage: ${metrics.nomineeCoveragePct}% of value has a nominee; ${metrics.assetsWithoutNominee} asset(s) have none.`,
      `${metrics.maturingSoon.count} asset(s) mature within ${metrics.maturingSoon.days} days.`,
    ]
      .filter(Boolean)
      .join('\n');

    const system = [
      'You are a careful wealth-planning assistant for an Indian individual reviewing their own net worth.',
      'Use ONLY the metrics provided — never invent or recompute figures, never quote a number not given.',
      'Focus on: concentration/diversification, liquidity & upcoming maturities, and succession readiness (nominee coverage).',
      'Be concise and practical. This is general organisation guidance, NOT investment advice to buy/sell specific securities.',
      'Return strictly via the provided schema.',
    ].join('\n');

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: {
          type: 'string',
          description: '2–4 sentence plain-language overview of the portfolio.',
        },
        risks: {
          type: 'array',
          description: 'Concentration, liquidity, or succession risks.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
              severity: { type: 'string', description: 'info | warning | high' },
            },
          },
        },
        suggestions: {
          type: 'array',
          description: 'Prioritised, concrete next actions.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              detail: { type: 'string' },
            },
          },
        },
      },
    } as unknown as Parameters<AiService['extract']>[1];

    const instruction = `Analyse this net-worth snapshot and return a summary, risks, and prioritised suggestions.\n\nMetrics:\n${facts}`;
    const { data } = await this.ai.extract<AiPortfolioNarrative>(
      [{ kind: 'text', text: instruction }],
      schema,
      { systemPrompt: system, schemaName: 'portfolio_analysis', instruction },
    );
    return data;
  }
}
