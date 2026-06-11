import type { AdminFieldMap, AdminSchemaDetail } from '@org/api-client';
import { Button, Card, Input } from '@org/ui';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { applyServerFieldErrors } from '../../../lib/server-errors';
import { useFieldMap, useSaveFieldMap, useSchema } from './queries';

interface Props {
  schemaKey: string;
  onClose: () => void;
}

/**
 * Field-map editor (docs/05 §11.4): map each extraction field key → a dot-path
 * in the drafting `DocumentTypeBundle`, so the export/convert step can prefill a
 * structured, editable document. Only meaningful for a type with a drafting
 * `documentTypeKey`; read-only types skip export (freeform fallback).
 */
export function FieldMapEditor({ schemaKey, onClose }: Props) {
  const { t } = useTranslation();
  const { data: schema } = useSchema(schemaKey);
  const { data: fieldMap, isLoading } = useFieldMap(schemaKey);

  // Wait for the schema (the field-map 404s when none exists yet — expected).
  if (isLoading && !schema) {
    return (
      <p className="text-foreground/60 text-sm">
        {t('common.loading', 'Loading…')}
      </p>
    );
  }
  if (!schema) return null;

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

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">
            {t('adminIntel.map.title', 'Field mapping')} — {schema.name}
          </h3>
          <p className="text-xs text-foreground/50">
            {t(
              'adminIntel.map.hint',
              'extraction field → document path (dot-notation, e.g. parties.landlord.name). Blank = not mapped.',
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={!docTypeKey || save.isPending}>
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
      ) : (
        <div className="space-y-2">
          {schema.fields.map((f) => (
            <Card key={f.key} className="flex items-center gap-3 p-2">
              <span className="w-1/2 truncate text-sm" title={f.key}>
                <span className="font-medium">{f.label}</span>
                <span className="text-foreground/40"> · {f.key}</span>
              </span>
              <span className="text-foreground/30">→</span>
              <Input
                className="flex-1"
                placeholder={t('adminIntel.map.path', 'document.path')}
                {...register(`mapping.${f.key}`)}
              />
            </Card>
          ))}
        </div>
      )}
    </form>
  );
}
