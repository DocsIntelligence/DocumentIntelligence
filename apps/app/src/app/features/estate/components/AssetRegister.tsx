import type { EstateReportAsset } from '@org/api-client';
import { Card } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../queries';

/** Shared renderer for the Estate Report / Asset Register (docs/13 §10.3) —
 *  used by the owner preview and the released nominee view. */
export function AssetRegister({
  assets,
  currency,
  totalValue,
}: {
  assets: EstateReportAsset[];
  currency: string;
  totalValue: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-5">
        <span className="text-sm text-foreground/60">
          {t('estate.totalValue', 'Total recorded value')}
        </span>
        <span className="text-2xl font-semibold">
          {formatMoney(totalValue, currency)}
        </span>
      </Card>

      {assets.map((a) => (
        <Card key={a.id} className="space-y-2 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{a.label}</p>
              <p className="text-xs text-foreground/60">
                {a.typeLabel}
                {a.institution ? ` · ${a.institution}` : ''}
              </p>
            </div>
            <span className="font-semibold">
              {formatMoney(a.value, a.currency)}
            </span>
          </div>
          <p className="text-sm text-foreground/70">
            {t('estate.identifier', 'Account / policy number')}:{' '}
            <span className="font-mono">
              {a.identifier ?? a.identifierMasked ?? '—'}
            </span>
          </p>
          {a.nominees.length > 0 && (
            <p className="text-xs text-foreground/60">
              {t('estate.nominees', 'Nominees')}:{' '}
              {a.nominees.map((n) => n.name).join(', ')}
            </p>
          )}
          <p className="rounded-md bg-muted/50 p-3 text-sm text-foreground/80">
            <span className="font-medium">{t('estate.howToClaim', 'How to claim')}: </span>
            {a.howToClaim}
          </p>
        </Card>
      ))}
    </div>
  );
}
