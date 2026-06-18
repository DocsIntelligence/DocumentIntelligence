import {
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import type { PortfolioAnalysis } from '@org/api-client';
import { cn } from '@org/utils';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../../../components/page-header';
import { useEstateService } from '../../documents/services-context';
import {
  ChartLegend,
  DonutChart,
  HBarList,
  TrendChart,
  colorAt,
  type DonutSlice,
} from '../components/charts';
import { useActiveProfile } from '../profile-context';
import {
  formatMoney,
  useNetWorth,
  useNetWorthHistory,
  useNudges,
} from '../queries';

type CategoryFilter = 'all' | 'financial' | 'physical' | 'other';
type RangeFilter = '3m' | '6m' | '1y' | 'all';

/**
 * Estate overview — a net-worth dashboard: the headline number, allocation,
 * net-worth-over-time, and top holdings, each filterable. Detail still lives a
 * tap away (assets, nominees, report).
 */
export function EstateHomePage() {
  const { t } = useTranslation();
  const { data, isLoading } = useNetWorth();
  const { data: history } = useNetWorthHistory();
  const { data: nudges } = useNudges();
  const { maskAmounts } = useActiveProfile();

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [range, setRange] = useState<RangeFilter>('1y');

  const currency = data?.currency ?? 'INR';
  const byType = useMemo(() => data?.byType ?? [], [data]);

  const categoryLabel = (c: string) =>
    c === 'financial'
      ? t('estate.catFinancial', 'Financial')
      : c === 'physical'
        ? t('estate.catPhysical', 'Physical')
        : t('estate.catOther', 'Other');

  // Allocation slices for the active category filter.
  const filtered = useMemo(
    () =>
      category === 'all'
        ? byType
        : byType.filter((b) => b.category === category),
    [byType, category],
  );
  const filteredTotal = useMemo(
    () => filtered.reduce((s, b) => s + b.value, 0),
    [filtered],
  );
  const allocation: DonutSlice[] = useMemo(
    () => filtered.map((b, i) => ({ label: b.label, value: b.value, color: colorAt(i) })),
    [filtered],
  );
  const topHoldings = useMemo(() => allocation.slice(0, 6), [allocation]);

  // Category roll-up (always across everything).
  const byCategory: DonutSlice[] = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of byType) m.set(b.category, (m.get(b.category) ?? 0) + b.value);
    return ['financial', 'physical', 'other']
      .filter((c) => m.has(c))
      .map((c, i) => ({ label: categoryLabel(c), value: m.get(c) ?? 0, color: colorAt(i) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byType]);

  // Net-worth-over-time, clipped to the selected range.
  const trendPoints = useMemo(() => {
    const pts = (history ?? []).map((h) => ({ asOf: h.asOf, value: h.netWorth }));
    if (range === 'all' || pts.length === 0) return pts;
    const months = range === '3m' ? 3 : range === '6m' ? 6 : 12;
    const cutoff = Date.now() - months * 30 * 24 * 3600 * 1000;
    return pts.filter((p) => new Date(p.asOf).getTime() >= cutoff);
  }, [history, range]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const empty = !data || data.assetCount === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        back={false}
        title={t('estate.title', 'Wealth Vault')}
        subtitle={t(
          'estate.subtitle',
          'Everything you own, in one place — so nothing is ever lost.',
        )}
        secondaryActions={[
          { label: t('estate.searchVault', 'Search'), to: '/estate/search' },
          { label: t('estate.import', 'Import statement'), to: '/estate/import' },
        ]}
        actions={
          <Button asChild>
            <Link to="/estate/assets/new">{t('estate.addAsset', 'Add asset')}</Link>
          </Button>
        }
      />

      {empty ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <p className="max-w-md text-foreground/70">
            {t(
              'estate.emptyHero',
              'Start by adding one asset — a bank account, an FD, a mutual fund, gold or property. You can add the rest later.',
            )}
          </p>
          <Button asChild>
            <Link to="/estate/assets/new">
              {t('estate.addFirst', 'Add your first asset')}
            </Link>
          </Button>
        </Card>
      ) : (
        <>
          {/* Headline + trend, and allocation donut. */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="space-y-4 p-6 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-foreground/60">
                    {t('estate.netWorth', 'Net worth')}
                  </p>
                  <p className="text-4xl font-semibold tracking-tight text-foreground">
                    {formatMoney(data.netWorth, currency, maskAmounts)}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {t('estate.acrossAssets', 'Across {{count}} asset(s)', {
                      count: data.assetCount,
                    })}
                  </p>
                </div>
                <RangeSelect value={range} onChange={setRange} />
              </div>
              <TrendChart
                points={trendPoints}
                currency={currency}
                masked={maskAmounts}
              />
            </Card>

            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {t('estate.allocation', 'Allocation')}
                </p>
                <CategorySelect value={category} onChange={setCategory} t={t} />
              </div>
              {allocation.length === 0 ? (
                <p className="py-8 text-center text-sm text-foreground/50">
                  {t('estate.noAssetsInCategory', 'No assets in this category.')}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-5">
                  <DonutChart
                    slices={allocation}
                    centerLabel={formatMoney(filteredTotal, currency, maskAmounts)}
                    centerSub={t('estate.total', 'Total')}
                  />
                  <ChartLegend
                    items={allocation}
                    total={filteredTotal}
                    currency={currency}
                    masked={maskAmounts}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Top holdings + category split. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {t('estate.topHoldings', 'Top holdings')}
                </p>
                <Link
                  to="/estate/assets"
                  className="text-xs text-primary hover:underline"
                >
                  {t('estate.viewAll', 'View all assets')}
                </Link>
              </div>
              {topHoldings.length > 0 ? (
                <HBarList rows={topHoldings} currency={currency} masked={maskAmounts} />
              ) : (
                <p className="py-6 text-center text-sm text-foreground/50">
                  {t('estate.noAssetsInCategory', 'No assets in this category.')}
                </p>
              )}
            </Card>

            <Card className="space-y-4 p-6">
              <p className="text-sm font-medium text-foreground">
                {t('estate.byCategory', 'Financial vs physical')}
              </p>
              {byCategory.length > 0 ? (
                <HBarList rows={byCategory} currency={currency} masked={maskAmounts} />
              ) : (
                <p className="py-6 text-center text-sm text-foreground/50">
                  {t('estate.noData', 'Nothing to show yet.')}
                </p>
              )}
            </Card>
          </div>

          <WealthAnalysisCard />

          {nudges && nudges.length > 0 && (
            <Card className="space-y-2 p-5">
              <p className="text-sm font-semibold text-foreground">
                {t('estate.review', 'Things to review')}
              </p>
              <ul className="space-y-1.5">
                {nudges.slice(0, 5).map((n, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className={
                        n.severity === 'warning'
                          ? 'mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-warning'
                          : 'mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-foreground/30'
                      }
                    />
                    {n.assetId ? (
                      <Link
                        to={`/estate/assets/${n.assetId}`}
                        className="text-foreground/80 hover:underline"
                      >
                        {n.message}
                      </Link>
                    ) : (
                      <span className="text-foreground/80">{n.message}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickLink
              to="/estate/nominees"
              title={t('estate.nominees', 'Nominees')}
              desc={t('estate.nomineesQuick', 'Who can claim, after release')}
            />
            <QuickLink
              to="/estate/release"
              title={t('estate.release', 'Release & check-in')}
              desc={t('estate.releaseQuick', 'Keep your vault private while you’re here')}
            />
            <QuickLink
              to="/estate/report"
              title={t('estate.reportTitle', 'Estate Report')}
              desc={t('estate.reportQuick', 'What your family will receive')}
            />
          </div>
        </>
      )}
    </div>
  );
}

function RangeSelect({
  value,
  onChange,
}: {
  value: RangeFilter;
  onChange: (v: RangeFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RangeFilter)}>
      <SelectTrigger className="h-8 w-28 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="3m">{t('estate.range3m', '3 months')}</SelectItem>
        <SelectItem value="6m">{t('estate.range6m', '6 months')}</SelectItem>
        <SelectItem value="1y">{t('estate.range1y', '1 year')}</SelectItem>
        <SelectItem value="all">{t('estate.rangeAll', 'All time')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function CategorySelect({
  value,
  onChange,
  t,
}: {
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CategoryFilter)}>
      <SelectTrigger className="h-8 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('estate.catAll', 'All assets')}</SelectItem>
        <SelectItem value="financial">{t('estate.catFinancial', 'Financial')}</SelectItem>
        <SelectItem value="physical">{t('estate.catPhysical', 'Physical')}</SelectItem>
        <SelectItem value="other">{t('estate.catOther', 'Other')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

/** AI wealth analysis across the whole portfolio (on demand). */
function WealthAnalysisCard() {
  const { t } = useTranslation();
  const svc = useEstateService();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortfolioAnalysis | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      setData(await svc.analyzePortfolio());
    } catch {
      toast.error(t('estate.analyzeFailed', 'Could not analyze right now.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-3 p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {t('estate.wealthAnalysis', 'Wealth analysis')}
        </p>
        <Button
          size="sm"
          variant={data ? 'ghost' : undefined}
          onClick={run}
          disabled={loading}
        >
          {loading && <Spinner className="mr-2 h-4 w-4" />}
          {data ? t('estate.refresh', 'Refresh') : t('estate.generate', 'Generate')}
        </Button>
      </div>

      {!data ? (
        <p className="text-sm text-foreground/55">
          {t(
            'estate.wealthAnalysisHint',
            'Get an AI read on concentration, liquidity and nominee coverage across everything you own.',
          )}
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-foreground/80">{data.summary}</p>
          {data.risks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground/55">
                {t('estate.risks', 'Risks')}
              </p>
              <ul className="mt-1 space-y-1">
                {data.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 flex-none rounded-full',
                        r.severity === 'high'
                          ? 'bg-error'
                          : r.severity === 'warning'
                            ? 'bg-warning'
                            : 'bg-foreground/30',
                      )}
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        {r.title}.
                      </span>{' '}
                      <span className="text-foreground/70">{r.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground/55">
                {t('estate.suggestions', 'Suggestions')}
              </p>
              <ul className="mt-1 space-y-1">
                {data.suggestions.map((s, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground">{s.title}.</span>{' '}
                    <span className="text-foreground/70">{s.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function QuickLink({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-border/60 p-4 transition-colors hover:bg-muted/40"
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-foreground/60">{desc}</p>
    </Link>
  );
}
