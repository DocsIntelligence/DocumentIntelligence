import { Button, Card, Input } from '@org/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const save = useSaveFieldMap();

  const [mapping, setMapping] = useState<Record<string, string>>({});

  // Seed paths from the saved map once both schema + map have resolved.
  useEffect(() => {
    if (!schema) return;
    const next: Record<string, string> = {};
    for (const f of schema.fields) next[f.key] = fieldMap?.mapping?.[f.key] ?? '';
    setMapping(next);
  }, [schema, fieldMap]);

  if (isLoading && !schema) {
    return (
      <p className="text-foreground/60 text-sm">
        {t('common.loading', 'Loading…')}
      </p>
    );
  }
  if (!schema) return null;

  const docTypeKey = schema.documentTypeKey;

  const onSave = () => {
    if (!docTypeKey) return;
    const cleaned = Object.fromEntries(
      Object.entries(mapping).filter(([, v]) => v.trim()),
    );
    save.mutate(
      { schemaKey, documentTypeKey: docTypeKey, mapping: cleaned },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="space-y-4">
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
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={!docTypeKey || save.isPending}
          >
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
                value={mapping[f.key] ?? ''}
                placeholder={t('adminIntel.map.path', 'document.path')}
                onChange={(e) =>
                  setMapping((m) => ({ ...m, [f.key]: e.target.value }))
                }
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
