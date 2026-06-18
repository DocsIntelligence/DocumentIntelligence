import type { EstateAsset } from '@org/api-client';
import { Badge, Button, Card, Checkbox, FormField, Input, Spinner } from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../../../components/page-header';
import { useEstateService } from '../../documents/services-context';
import { metaForType } from '../asset-fields';
import {
  AssetDetailsFields,
  AssetDetailsView,
  detailsToFormValues,
  toDetailsPayload,
} from '../components/AssetDetailsFields';
import { AssetDocuments } from '../components/AssetDocuments';
import { useActiveProfile } from '../profile-context';
import {
  formatMoney,
  useAsset,
  useAssetValuations,
  useDeleteAsset,
  useNominations,
  useNominees,
  useRecordValuation,
  useSetNominations,
  useUpdateAsset,
} from '../queries';

/** Asset detail — value, masked identifier, quick re-value, and the
 *  value-over-time history (docs/13 §10.2). */
export function EstateAssetDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const svc = useEstateService();
  const { data: asset, isLoading } = useAsset(id);
  const { data: history } = useAssetValuations(id);
  const recordValuation = useRecordValuation(id);
  const del = useDeleteAsset();
  const { maskAmounts } = useActiveProfile();

  const [newValue, setNewValue] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);

  if (isLoading || !asset) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const updateValue = async () => {
    const parsed = Number.parseFloat(newValue);
    if (!Number.isFinite(parsed)) return;
    await recordValuation.mutateAsync({ value: parsed, currency: asset.currency });
    setNewValue('');
  };

  const reveal = async () => {
    try {
      const r = await svc.revealAsset(id);
      setRevealed(r.identifier ?? t('estate.noIdentifier', '(none stored)'));
    } catch {
      toast.error(t('estate.revealFailed', 'Could not reveal'));
    }
  };

  const remove = async () => {
    await del.mutateAsync(id);
    navigate('/estate/assets');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        backTo="/estate/assets"
        title={
          <span className="flex min-w-0 items-center gap-2">
            <Badge variant="secondary">{asset.type}</Badge>
            <span className="truncate">{asset.label}</span>
          </span>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={remove}
            disabled={del.isPending}
          >
            {t('common.delete', 'Delete')}
          </Button>
        }
      />

      <Card className="space-y-3 p-5">
        <Row label={t('estate.value', 'Value')}>
          <span className="text-lg font-semibold">
            {formatMoney(asset.value, asset.currency, maskAmounts)}
          </span>
        </Row>
        {asset.units != null && (
          <Row label={t('estate.units', 'Units / shares held')}>
            {asset.units.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </Row>
        )}
        <Row label={t('estate.institution', 'Institution')}>
          {asset.institution ?? '—'}
        </Row>
        <Row label={t('estate.status', 'Status')}>{asset.status}</Row>
        {asset.maturityDate && (
          <Row
            label={
              metaForType(asset.type).dateLabel
                ? t(
                    `estate.dateLabel.${asset.type}`,
                    metaForType(asset.type).dateLabel as string,
                  )
                : t('estate.maturityDate', 'Maturity date')
            }
          >
            {new Date(asset.maturityDate).toLocaleDateString('en-IN')}
          </Row>
        )}
        <Row label={`${t('estate.identifier', 'Account / policy number')} 🔒`}>
          {revealed ?? asset.identifierMasked ?? '—'}
          {!revealed && asset.identifierMasked && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2"
              onClick={reveal}
            >
              {t('estate.reveal', 'Reveal')}
            </Button>
          )}
        </Row>
      </Card>

      <AssetDetailsCard asset={asset} />

      <Card className="space-y-3 p-5">
        <p className="text-sm font-semibold text-foreground">
          {t('estate.updateValue', 'Update value')}
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField label={t('estate.newValue', 'New value (₹)')}>
              <Input
                type="number"
                inputMode="decimal"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="0"
              />
            </FormField>
          </div>
          <Button
            onClick={updateValue}
            disabled={!newValue.trim() || recordValuation.isPending}
          >
            {recordValuation.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('estate.record', 'Record')}
          </Button>
        </div>
      </Card>

      <AssetDocuments assetId={id} />

      <NomineeAssignment assetId={id} />

      {history && history.length > 0 && (
        <Card className="p-0">
          <p className="px-5 pt-4 text-sm font-semibold text-foreground">
            {t('estate.history', 'Value history')}
          </p>
          <div className="divide-y divide-border/60">
            {[...history].reverse().map((h, i) => (
              <div
                key={`${h.asOf}-${i}`}
                className="flex items-center justify-between px-5 py-2 text-sm"
              >
                <span className="text-foreground/60">
                  {new Date(h.asOf).toLocaleDateString('en-IN')}
                </span>
                <span className="font-medium">
                  {formatMoney(h.value, h.currency, maskAmounts)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/** Per-type structured details — read-only by default, inline-editable. */
function AssetDetailsCard({ asset }: { asset: EstateAsset }) {
  const { t } = useTranslation();
  const meta = metaForType(asset.type);
  const update = useUpdateAsset(asset.id);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    detailsToFormValues(asset.details),
  );

  // Nothing to show or edit for this kind.
  if (meta.fields.length === 0 && !asset.details) return null;

  const startEdit = () => {
    setValues(detailsToFormValues(asset.details));
    setEditing(true);
  };
  const save = async () => {
    await update.mutateAsync({ details: toDetailsPayload(asset.type, values) ?? {} });
    setEditing(false);
  };

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {t('estate.detailsSection', 'Details')}
        </p>
        {meta.fields.length > 0 &&
          (editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={startEdit}>
              {t('common.edit', 'Edit')}
            </Button>
          ))}
      </div>

      {editing ? (
        <div className="space-y-3">
          <AssetDetailsFields type={asset.type} value={values} onChange={setValues} />
          <div className="flex justify-end">
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('common.save', 'Save')}
            </Button>
          </div>
        </div>
      ) : asset.details ? (
        <AssetDetailsView type={asset.type} details={asset.details} />
      ) : (
        <p className="text-sm text-foreground/55">
          {t('estate.noDetails', 'No details yet — add the policy/scheme specifics.')}
        </p>
      )}
    </Card>
  );
}

/** Assign which nominees are designated for this asset (≤4, docs/13 §9). */
function NomineeAssignment({ assetId }: { assetId: string }) {
  const { t } = useTranslation();
  const { data: nominees } = useNominees();
  const { data: nominations } = useNominations(assetId);
  const setNom = useSetNominations(assetId);

  const selected = new Set((nominations ?? []).map((n) => n.nomineeId));

  const toggle = (nomineeId: string) => {
    const next = new Set(selected);
    if (next.has(nomineeId)) next.delete(nomineeId);
    else next.add(nomineeId);
    const ids = [...next].slice(0, 4);
    setNom.mutate({
      nominations: ids.map((id, i) => ({ nomineeId: id, priority: i + 1 })),
    });
  };

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm font-semibold text-foreground">
        {t('estate.nomineesForAsset', 'Nominees for this asset')}
      </p>
      {(nominees ?? []).length === 0 ? (
        <p className="text-sm text-foreground/60">
          {t('estate.addNomineesFirst', 'Add nominees first, then assign them here.')}{' '}
          <Link to="/estate/nominees" className="text-info hover:underline">
            {t('estate.manageNominees', 'Manage nominees')}
          </Link>
        </p>
      ) : (
        <div className="space-y-2">
          {(nominees ?? []).map((n) => (
            <label key={n.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.has(n.id)}
                onCheckedChange={() => toggle(n.id)}
              />
              <span>{n.name}</span>
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground/60">{label}</span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  );
}
