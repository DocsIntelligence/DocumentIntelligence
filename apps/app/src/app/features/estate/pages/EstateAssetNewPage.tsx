import type { CreateAssetPayload } from '@org/api-client';
import {
  Button,
  Card,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../../../components/page-header';
import { useEstateService } from '../../documents/services-context';
import { metaForType } from '../asset-fields';
import {
  AssetDetailsFields,
  toDetailsPayload,
} from '../components/AssetDetailsFields';
import { useAssetTypes, useCreateAsset } from '../queries';

/** Guided "add an asset" — a few fields, no wall (docs/13 §8). */
export function EstateAssetNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateAsset();
  const { data: types } = useAssetTypes();
  const svc = useEstateService();

  const [type, setType] = useState('bank');
  const [label, setLabel] = useState('');
  const [institution, setInstitution] = useState('');
  const [value, setValue] = useState('');
  const [units, setUnits] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [maturityDate, setMaturityDate] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);

  const typeEntry = (types ?? []).find((tp) => tp.key === type);
  const tracksUnits = typeEntry?.tracksUnits ?? false;
  const typeMeta = metaForType(type);
  // Prefer org-configured fields/dateLabel (resolved server-side); fall back to
  // the shared code registry so it works without any config.
  const typeFields = typeEntry?.fields ?? typeMeta.fields;
  const dateLabel = typeEntry?.dateLabel ?? typeMeta.dateLabel;
  const maturityLabel = dateLabel
    ? t(`estate.dateLabel.${type}`, dateLabel)
    : t('estate.maturityDate', 'Maturity date');

  const autofill = async (file: File | undefined) => {
    if (!file) return;
    setExtracting(true);
    try {
      const s = await svc.extractFromUpload(file, undefined, type);
      if (s.type) setType(s.type);
      if (s.institution) setInstitution(s.institution);
      if (s.value !== undefined) setValue(String(s.value));
      if (s.units !== undefined) setUnits(String(s.units));
      if (s.identifier) setIdentifier(s.identifier);
      if (s.maturityDate) setMaturityDate(s.maturityDate);
      if (s.details) {
        const seeded: Record<string, string> = {};
        for (const [k, v] of Object.entries(s.details)) seeded[k] = String(v);
        setDetails(seeded);
      }
      if (!label.trim() && s.institution) setLabel(s.institution);
      toast.success(
        t('estate.autofilled', 'Read your document — review the fields and save.'),
      );
    } catch {
      toast.error(t('estate.extractFailed', 'Could not read that document.'));
    } finally {
      setExtracting(false);
    }
  };

  const canSave = !!label.trim() && !!type && !create.isPending;

  const submit = async () => {
    if (!canSave) return;
    const payload: CreateAssetPayload = {
      type,
      label: label.trim(),
      institution: institution.trim() || undefined,
      identifier: identifier.trim() || undefined,
      maturityDate: maturityDate || undefined,
    };
    const parsed = Number.parseFloat(value);
    if (value.trim() && Number.isFinite(parsed)) payload.value = parsed;
    const parsedUnits = Number.parseFloat(units);
    if (tracksUnits && units.trim() && Number.isFinite(parsedUnits)) {
      payload.units = parsedUnits;
    }
    const detailsPayload = toDetailsPayload(type, details, typeFields);
    if (detailsPayload) payload.details = detailsPayload;
    const asset = await create.mutateAsync(payload);
    navigate(`/estate/assets/${asset.id}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('estate.newTitle', 'Add an asset')}
        subtitle={t(
          'estate.newSubtitle',
          'Just the basics for now — you can add documents and history later.',
        )}
        backTo="/estate/assets"
      />

      <Card className="flex items-center justify-between gap-3 border-dashed p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t('estate.autofillTitle', 'Autofill from a statement')}
          </p>
          <p className="text-xs text-foreground/60">
            {t(
              'estate.autofillHint',
              'Upload a bank/MF/insurance statement and we’ll prefill the fields.',
            )}
          </p>
        </div>
        <label className="flex-none">
          <input
            type="file"
            className="hidden"
            accept="application/pdf,image/*"
            onChange={(e) => autofill(e.target.files?.[0])}
          />
          <span className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted/40">
            {extracting && <Spinner className="mr-2 h-4 w-4" />}
            {t('estate.uploadStatement', 'Upload')}
          </span>
        </label>
      </Card>

      <Card className="space-y-4 p-5">
        <FormField label={t('estate.type', 'Type')}>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(types ?? []).map((tp) => (
                <SelectItem key={tp.key} value={tp.key}>
                  {tp.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label={t('estate.name', 'Name')}>
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('estate.namePlaceholder', 'e.g. HDFC FD — emergency')}
          />
        </FormField>

        <FormField label={t('estate.institution', 'Institution')}>
          <Input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder={t('estate.institutionPlaceholder', 'e.g. HDFC Bank, LIC')}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t('estate.currentValue', 'Current value (₹)')}>
            <Input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </FormField>
          <FormField label={maturityLabel}>
            <Input
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
            />
          </FormField>
          {tracksUnits && (
            <FormField label={t('estate.units', 'Units / shares held')}>
              <Input
                type="number"
                inputMode="decimal"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder={t('estate.unitsPlaceholder', 'e.g. 1234.567')}
              />
            </FormField>
          )}
        </div>

        <FormField
          label={`${t('estate.identifier', 'Account / policy number')} 🔒`}
        >
          <Input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t('estate.identifierPlaceholder', 'Stored encrypted')}
          />
        </FormField>

        {typeFields.length > 0 && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <p className="text-sm font-medium text-foreground">
              {t('estate.detailsSection', 'Details')}
            </p>
            <AssetDetailsFields
              type={type}
              value={details}
              onChange={setDetails}
              fields={typeFields}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost">
            <Link to="/estate/assets">{t('common.cancel', 'Cancel')}</Link>
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {create.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('estate.create', 'Add asset')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
