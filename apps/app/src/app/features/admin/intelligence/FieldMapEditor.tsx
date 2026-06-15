import type { AdminFieldMap, AdminSchemaDetail } from '@org/api-client';
import { Badge, Button, Card, Input } from '@org/ui';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { applyServerFieldErrors } from '../../../lib/server-errors';
import { useFieldMap, useSaveFieldMap, useSchema } from './queries';

interface Props {
  schemaKey: string;
  onClose: () => void;
}

/** Title-case a snake_case / kebab-case key into a human label. */
const humanise = (key: string) =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Field-map editor (docs/05 §11.4): map each extraction field key → a dot-path
 * in the drafting `DocumentTypeBundle`, so the export/convert step can prefill a
 * structured, editable document. Only meaningful for a type with a drafting
 * `documentTypeKey`; read-only types skip export (freeform fallback).
 */
export function FieldMapEditor({ schemaKey, onClose }: Props) {
  const { t } = useTranslation();
  const { data: schema, isLoading: schemaLoading } = useSchema(schemaKey);
  const { data: fieldMap, isLoading: mapLoading } = useFieldMap(schemaKey);

  if ((schemaLoading || mapLoading) && !schema) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-secondary/40"
          />
        ))}
      </div>
    );
  }
  if (!schema) {
    return (
      <p className="text-sm text-foreground/60">
        {t('adminIntel.map.notFound', 'Schema not found.')}
      </p>
    );
  }

  return (
    <MapForm
      key={schemaKey}
      schemaKey={schemaKey}
      schema={schema}
      fieldMap={fieldMap}
      onClose={onClose}
    />
  );
}

interface MapFormValues {
  mapping: Record<string, string>;
}

function MapForm({
  schemaKey,
  schema,
  fieldMap,
  onClose,
}: {
  schemaKey: string;
  schema: AdminSchemaDetail;
  fieldMap?: AdminFieldMap;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveFieldMap();
  const docTypeKey = schema.documentTypeKey;

  const { register, handleSubmit, setError } = useForm<MapFormValues>({
    defaultValues: {
      mapping: Object.fromEntries(
        schema.fields.map((f) => [f.key, fieldMap?.mapping?.[f.key] ?? '']),
      ),
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!docTypeKey) return;
    const cleaned = Object.fromEntries(
      Object.entries(values.mapping).filter(([, v]) => v.trim()),
    );
    save.mutate(
      { schemaKey, documentTypeKey: docTypeKey, mapping: cleaned },
      {
        onSuccess: onClose,
        onError: (err) => applyServerFieldErrors(err, setError),
      },
    );
  });

  const typeLabel = (schema.name?.trim() || humanise(schemaKey)).trim();

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {/* Context strip */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-foreground">
            {typeLabel}
          </span>
          <span className="font-mono text-xs text-foreground/45">
            {schemaKey}
          </span>
          {docTypeKey ? (
            <Badge variant="secondary" outline>
              {docTypeKey}
            </Badge>
          ) : (
            <Badge variant="info" outline>
              {t('adminIntel.schema.readOnly', 'read-only')}
            </Badge>
          )}
          <span className="text-xs text-foreground/55">
            {t('adminIntel.map.fieldCount', '{{n}} fields', {
              n: schema.fields.length,
            })}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common.back', 'Back to types')}
          </Button>
          <Button type="submit" disabled={!docTypeKey || save.isPending}>
            {save.isPending
              ? t('common.saving', 'Saving…')
              : t('adminIntel.map.save', 'Save mapping')}
          </Button>
        </div>
      </div>

      {!docTypeKey ? (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          {t(
            'adminIntel.map.noDocType',
            'This is a read-only type (no drafting key), so there is nothing to map — extractions are reviewed but not converted to a structured document.',
          )}
        </p>
      ) : schema.fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-foreground/55">
          {t(
            'adminIntel.map.noFields',
            'This type has no extraction fields to map yet.',
          )}
        </p>
      ) : (
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 pb-1">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
              {t('adminIntel.map.extractionField', 'Extraction field')}
            </span>
            <span />
            <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
              {t('adminIntel.map.documentPath', 'Document path')}
            </span>
          </div>
          {schema.fields.map((f) => (
            <Card
              key={f.key}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2"
            >
              <span className="min-w-0 text-sm" title={f.key}>
                <span className="block truncate font-medium text-foreground">
                  {f.label}
                </span>
                <span className="block truncate font-mono text-xs text-foreground/45">
                  {f.key}
                </span>
              </span>
              <span className="text-foreground/30">→</span>
              <Input
                className="w-full font-mono text-xs"
                placeholder={t('adminIntel.map.path', 'parties.landlord.name')}
                {...register(`mapping.${f.key}`)}
              />
            </Card>
          ))}
        </div>
      )}
    </form>
  );
}
