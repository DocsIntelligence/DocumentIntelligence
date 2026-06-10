import type { AdminFieldType, AdminSchemaField } from '@org/api-client';
import { Badge, Button, Card, Checkbox, Input } from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import {
  useDeleteSchema,
  useSaveSchema,
  useSchema,
  useSchemas,
} from './queries';

const FIELD_TYPES: AdminFieldType[] = [
  'string',
  'number',
  'currency',
  'date',
  'boolean',
  'enum',
  'table',
];

interface EditorState {
  key: string;
  name: string;
  documentTypeKey: string;
  description: string;
  jurisdiction: string;
  fields: AdminSchemaField[];
}

const blankField = (): AdminSchemaField => ({
  key: '',
  label: '',
  type: 'string',
  required: false,
});

/**
 * Admin schema editor (docs/07 P4.2). Lists authored extraction schemas and
 * edits one's fields as config-as-data. Saving an existing schema mints a new
 * immutable version server-side.
 */
export function SchemaManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { data: schemas, isLoading } = useSchemas();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<EditorState | null>(null);
  const { data: loaded } = useSchema(editingKey);
  const save = useSaveSchema();
  const del = useDeleteSchema();

  // Hydrate the draft when a schema finishes loading for edit.
  if (editingKey && loaded && draft?.key !== loaded.key) {
    setDraft({
      key: loaded.key,
      name: loaded.name,
      documentTypeKey: loaded.documentTypeKey ?? '',
      description: loaded.description ?? '',
      jurisdiction: loaded.jurisdiction ?? '',
      fields: loaded.fields.map((f) => ({ ...f })),
    });
  }

  const startCreate = () => {
    setEditingKey(null);
    setCreating(true);
    setDraft({
      key: '',
      name: '',
      documentTypeKey: '',
      description: '',
      jurisdiction: '',
      fields: [blankField()],
    });
  };

  const close = () => {
    setDraft(null);
    setEditingKey(null);
    setCreating(false);
  };

  const setField = (i: number, patch: Partial<AdminSchemaField>) => {
    if (!draft) return;
    const fields = draft.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    setDraft({ ...draft, fields });
  };

  const moveField = (i: number, dir: -1 | 1) => {
    if (!draft) return;
    const j = i + dir;
    if (j < 0 || j >= draft.fields.length) return;
    const fields = [...draft.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    setDraft({ ...draft, fields });
  };

  const onSave = () => {
    if (!draft) return;
    if (!draft.key.trim() || !draft.name.trim()) {
      return;
    }
    save.mutate(
      {
        exists: !creating,
        payload: {
          key: draft.key.trim(),
          name: draft.name.trim(),
          documentTypeKey: draft.documentTypeKey.trim() || null,
          description: draft.description.trim() || undefined,
          jurisdiction: draft.jurisdiction.trim() || undefined,
          fields: draft.fields
            .filter((f) => f.key.trim() && f.label.trim())
            .map((f) => ({
              ...f,
              key: f.key.trim(),
              label: f.label.trim(),
              enumValues:
                f.type === 'enum' ? f.enumValues?.filter(Boolean) : undefined,
            })),
        },
      },
      { onSuccess: close },
    );
  };

  if (draft) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">
            {creating
              ? t('adminIntel.schema.createTitle', 'New document type')
              : t('adminIntel.schema.editTitle', 'Edit document type')}
          </h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={close}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button size="sm" onClick={onSave} disabled={save.isPending}>
              {save.isPending
                ? t('common.saving', 'Saving…')
                : t('adminIntel.schema.saveVersion', 'Save (new version)')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-foreground/60">
              {t('adminIntel.schema.key', 'Key (stable id)')}
            </span>
            <Input
              value={draft.key}
              disabled={!creating}
              placeholder="contractor_agreement"
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-foreground/60">
              {t('adminIntel.schema.name', 'Display name')}
            </span>
            <Input
              value={draft.name}
              placeholder="Contractor Agreement"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-foreground/60">
              {t('adminIntel.schema.docTypeKey', 'Drafting type key (optional)')}
            </span>
            <Input
              value={draft.documentTypeKey}
              placeholder="(leave blank for read-only types)"
              onChange={(e) =>
                setDraft({ ...draft, documentTypeKey: e.target.value })
              }
            />
          </label>
          <label className="text-sm">
            <span className="text-foreground/60">
              {t('adminIntel.schema.jurisdiction', 'Jurisdiction (optional)')}
            </span>
            <Input
              value={draft.jurisdiction}
              placeholder="IN-MH"
              onChange={(e) =>
                setDraft({ ...draft, jurisdiction: e.target.value })
              }
            />
          </label>
        </div>
        <label className="text-sm block">
          <span className="text-foreground/60">
            {t('adminIntel.schema.description', 'Description')}
          </span>
          <Input
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
          />
        </label>

        <div className="flex items-center justify-between pt-2">
          <h4 className="font-medium text-foreground">
            {t('adminIntel.schema.fields', 'Fields')}
          </h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setDraft({ ...draft, fields: [...draft.fields, blankField()] })
            }
          >
            {t('adminIntel.schema.addField', '+ Add field')}
          </Button>
        </div>

        <div className="space-y-2">
          {draft.fields.map((f, i) => (
            <Card key={i} className="p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={f.key}
                  placeholder={t('adminIntel.schema.fieldKey', 'field_key')}
                  onChange={(e) => setField(i, { key: e.target.value })}
                />
                <Input
                  value={f.label}
                  placeholder={t('adminIntel.schema.fieldLabel', 'Label')}
                  onChange={(e) => setField(i, { label: e.target.value })}
                />
                <select
                  className="border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                  value={f.type}
                  onChange={(e) =>
                    setField(i, { type: e.target.value as AdminFieldType })
                  }
                >
                  {FIELD_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {ty}
                    </option>
                  ))}
                </select>
              </div>
              {f.type === 'enum' && (
                <Input
                  value={(f.enumValues ?? []).join(', ')}
                  placeholder={t(
                    'adminIntel.schema.enumValues',
                    'Allowed values (comma-separated)',
                  )}
                  onChange={(e) =>
                    setField(i, {
                      enumValues: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <Checkbox
                    checked={Boolean(f.required)}
                    onCheckedChange={(v) => setField(i, { required: Boolean(v) })}
                  />
                  {t('adminIntel.schema.required', 'Required')}
                </label>
                <label className="flex items-center gap-1.5">
                  <Checkbox
                    checked={Boolean(f.reviewMandatory)}
                    onCheckedChange={(v) =>
                      setField(i, { reviewMandatory: Boolean(v) })
                    }
                  />
                  {t('adminIntel.schema.reviewMandatory', 'Always review')}
                </label>
                <Input
                  className="w-32"
                  value={f.format ?? ''}
                  placeholder={t('adminIntel.schema.format', 'format')}
                  onChange={(e) => setField(i, { format: e.target.value })}
                />
                <div className="ml-auto flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveField(i, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveField(i, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        fields: draft.fields.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-foreground/60 text-sm">
          {t(
            'adminIntel.schema.intro',
            'Document types and the fields the AI extracts from each. Read-only types (no drafting key) are still classified and extracted.',
          )}
        </p>
        <Button size="sm" onClick={startCreate}>
          {t('adminIntel.schema.create', '+ New type')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-foreground/60 text-sm">{t('common.loading', 'Loading…')}</p>
      ) : (
        <div className="space-y-2">
          {(schemas ?? []).map((s) => (
            <Card
              key={s.key}
              className="p-3 flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <Badge variant="secondary">v{s.version}</Badge>
                  {!s.documentTypeKey && (
                    <Badge variant="info">
                      {t('adminIntel.schema.readOnly', 'read-only')}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-foreground/50">
                  {s.key} · {s.fieldCount}{' '}
                  {t('adminIntel.schema.fieldsLower', 'fields')}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCreating(false);
                    setDraft(null);
                    setEditingKey(s.key);
                  }}
                >
                  {t('common.edit', 'Edit')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-error"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t('adminIntel.schema.deleteTitle', 'Deactivate type?'),
                      description: t(
                        'adminIntel.schema.deleteDesc',
                        'New runs fall back to the built-in default. Existing extractions are unaffected.',
                      ),
                      confirmLabel: t('common.delete', 'Delete'),
                      variant: 'destructive',
                    });
                    if (ok) del.mutate(s.key);
                  }}
                >
                  {t('common.delete', 'Delete')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
