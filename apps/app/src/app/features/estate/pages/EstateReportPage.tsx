import { Button, Card, Spinner } from '@org/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../../components/page-header';
import { useEstateService } from '../../documents/services-context';
import { AssetRegister } from '../components/AssetRegister';
import {
  ChartLegend,
  DonutChart,
  colorAt,
  type DonutSlice,
} from '../components/charts';
import { useOwnerReport } from '../queries';

/** Owner preview of the Estate Report — "what my family will see" (docs/13
 *  §10.3). Identifiers stay masked here; the released nominee view reveals them. */
export function EstateReportPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useOwnerReport();
  const svc = useEstateService();
  const [downloading, setDownloading] = useState(false);

  // Allocation by asset type, derived from the report's asset rows.
  const byType: DonutSlice[] = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of data?.assets ?? [])
      m.set(a.typeLabel, (m.get(a.typeLabel) ?? 0) + a.value);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: colorAt(i) }));
  }, [data]);

  // Nominee coverage: how much of the estate already has a nominee assigned.
  const coverage: DonutSlice[] = useMemo(() => {
    if (!data) return [];
    const withNominee = data.assets.filter((a) => a.nominees.length > 0);
    const covered = withNominee.reduce((s, a) => s + a.value, 0);
    const uncovered = data.totalValue - covered;
    return [
      {
        label: t('estate.covered', 'Has a nominee'),
        value: covered,
        color: '--color-success',
      },
      {
        label: t('estate.uncovered', 'No nominee'),
        value: Math.max(0, uncovered),
        color: '--color-warning',
      },
    ];
  }, [data, t]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const blob = await svc.ownerReportPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'estate-report.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('estate.pdfFailed', 'Could not generate the PDF.'));
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('estate.reportTitle', 'Estate Report')}
        subtitle={t(
          'estate.reportSubtitle',
          'The register your nominee receives — every asset and how to claim it.',
        )}
        backTo="/estate"
        actions={
          <>
            <Button size="sm" onClick={downloadPdf} disabled={downloading}>
              {downloading && <Spinner className="mr-2 h-4 w-4" />}
              {t('estate.downloadPdf', 'Download PDF')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              {t('estate.print', 'Print')}
            </Button>
          </>
        }
      />

      {data.assetsWithoutNominee > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-4 text-sm text-foreground/80">
          {t(
            'estate.gapNudge',
            '{{n}} asset(s) have no nominee. Assign nominees and keep a will so your family can claim them.',
            { n: data.assetsWithoutNominee },
          )}
        </Card>
      )}

      {data.assets.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4 p-6">
            <p className="text-sm font-medium text-foreground">
              {t('estate.allocation', 'Allocation')}
            </p>
            <div className="flex flex-col items-center gap-5">
              <DonutChart
                slices={byType}
                centerLabel={String(data.assetCount)}
                centerSub={t('estate.assets', 'assets')}
              />
              <ChartLegend items={byType} total={data.totalValue} currency={data.currency} />
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <p className="text-sm font-medium text-foreground">
              {t('estate.nomineeCoverage', 'Nominee coverage')}
            </p>
            <div className="flex flex-col items-center gap-5">
              <DonutChart
                slices={coverage}
                centerLabel={`${
                  data.totalValue > 0
                    ? Math.round((coverage[0]?.value / data.totalValue) * 100)
                    : 0
                }%`}
                centerSub={t('estate.covered', 'Has a nominee')}
              />
              <ChartLegend items={coverage} total={data.totalValue} currency={data.currency} />
            </div>
          </Card>
        </div>
      )}

      <AssetRegister
        assets={data.assets}
        currency={data.currency}
        totalValue={data.totalValue}
      />
    </div>
  );
}
