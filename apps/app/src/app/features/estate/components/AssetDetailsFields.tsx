import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { useTranslation } from 'react-i18next';
import {
  metaForType,
  type AssetFieldDef,
} from '../asset-fields';

type FormValues = Record<string, string>;
type StoredDetails = Record<string, string | number | boolean> | null | undefined;

/**
 * Editable per-type detail fields. Renders the resolved field list — caller may
 * pass `fields` (org-configured, resolved server-side); falls back to the shared
 * code registry so it always works without config.
 */
export function AssetDetailsFields({
  type,
  value,
  onChange,
  fields,
}: {
  type: string;
  value: FormValues;
  onChange: (next: FormValues) => void;
  fields?: AssetFieldDef[];
}) {
  const { t } = useTranslation();
  const resolved = fields ?? metaForType(type).fields;
  if (resolved.length === 0) return null;

  const set = (key: string, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {resolved.map((f) => {
        const label = t(`estate.field.${f.key}`, f.label);
        const v = value[f.key] ?? '';
        if (f.type === 'select') {
          return (
            <FormField key={f.key} label={label}>
              <Select value={v || undefined} onValueChange={(nv) => set(f.key, nv)}>
                <SelectTrigger>
                  <SelectValue placeholder={t('common.select', 'Select…')} />
                </SelectTrigger>
                <SelectContent>
                  {f.options?.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {t(`estate.opt.${o.value}`, o.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          );
        }
        return (
          <FormField
            key={f.key}
            label={f.suffix ? `${label} (${f.suffix})` : label}
          >
            <Input
              type={
                f.type === 'number' || f.type === 'currency'
                  ? 'number'
                  : f.type === 'date'
                    ? 'date'
                    : 'text'
              }
              inputMode={
                f.type === 'number' || f.type === 'currency' ? 'decimal' : undefined
              }
              value={v}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </FormField>
        );
      })}
    </div>
  );
}

/** Read-only display of the per-type details (asset detail page, register). */
export function AssetDetailsView({
  type,
  details,
  fields,
}: {
  type: string;
  details: StoredDetails;
  fields?: AssetFieldDef[];
}) {
  const { t } = useTranslation();
  const resolved = fields ?? metaForType(type).fields;
  if (!details) return null;

  const rows = resolved
    .map((f) => ({ f, v: details[f.key] }))
    .filter((r) => r.v !== undefined && r.v !== '' && r.v !== null);
  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {rows.map(({ f, v }) => (
        <div key={f.key} className="flex justify-between gap-3 text-sm">
          <dt className="text-foreground/55">{t(`estate.field.${f.key}`, f.label)}</dt>
          <dd className="text-right text-foreground/90">{formatDetail(t, f, v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatDetail(
  t: ReturnType<typeof useTranslation>['t'],
  f: AssetFieldDef,
  v: string | number | boolean,
): string {
  if (f.type === 'select') {
    const opt = f.options?.find((o) => o.value === String(v));
    return opt ? t(`estate.opt.${opt.value}`, opt.label) : String(v);
  }
  return f.suffix ? `${v} ${f.suffix}` : String(v);
}

/** Coerce raw form strings into the typed `details` payload (drops empties). */
export function toDetailsPayload(
  type: string,
  value: FormValues,
  fields?: AssetFieldDef[],
): Record<string, string | number> | undefined {
  const resolved = fields ?? metaForType(type).fields;
  const out: Record<string, string | number> = {};
  for (const f of resolved) {
    const raw = (value[f.key] ?? '').trim();
    if (!raw) continue;
    if (f.type === 'number' || f.type === 'currency') {
      const n = Number(raw);
      if (Number.isFinite(n)) out[f.key] = n;
    } else {
      out[f.key] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Seed the editable form from stored details (everything as strings). */
export function detailsToFormValues(details: StoredDetails): FormValues {
  const out: FormValues = {};
  if (!details) return out;
  for (const [k, v] of Object.entries(details)) out[k] = String(v);
  return out;
}
