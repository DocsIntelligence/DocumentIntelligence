import type {
  AdminFieldType,
  AdminSchemaField,
  AdminSchemaSummary,
} from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type DataTableColumn,
} from '@org/ui';
import { cn } from '@org/utils';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { FieldMapEditor } from './FieldMapEditor';
import {
  CopyIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  IconButton,
  MapIcon,
  TrashIcon,
} from './icons';
import {
  usePurgeSchema,
  useSaveSchema,
  useSchema,
  useSchemas,
  useSetSchemaActive,
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
  isActive: true,
});

/**
 * Admin schema editor (docs/07 P4.2). Lists authored extraction schemas and
 * edits one's fields as config-as-data. Saving an existing schema mints a new
 * immutable version server-side.
 */
export function SchemaManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [showDisabled, setShowDisabled] = useState(false);
  const { data: schemas, isLoading } = useSchemas(showDisabled);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<EditorState | null>(null);
  const [mappingKey, setMappingKey] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const { data: loaded } = useSchema(editingKey);
  const save = useSaveSchema();
  const setActive = useSetSchemaActive();
  const purge = usePurgeSchema();

  // Hydrate the draft when the schema being edited/cloned finishes loading.
  // Cloning seeds a NEW key/name in create mode (mints v1) keeping all fields.
  useEffect(() => {
    if (!editingKey || !loaded) return;
    setDraft({
      key: cloning ? `${loaded.key}_copy` : loaded.key,
      name: cloning ? `${loaded.name} (copy)` : loaded.name,
      documentTypeKey: cloning ? '' : loaded.documentTypeKey ?? '',
      description: loaded.description ?? '',
      jurisdiction: loaded.jurisdiction ?? '',
      fields: loaded.fields.map((f) => ({ ...f })),
    });
    if (cloning) setCreating(true);
  }, [editingKey, loaded, cloning]);

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
    setCloning(false);
  };

  const startEdit = (key: string) => {
    setCloning(false);
    setCreating(false);
    setMappingKey(null);
    setDraft(null);
    setEditingKey(key);
  };

  const startClone = (key: string) => {
    setCloning(true);
    setMappingKey(null);
    setDraft(null);
    setEditingKey(key);
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

  if (mappingKey) {
    return (
      <FieldMapEditor
        schemaKey={mappingKey}
        onClose={() => setMappingKey(null)}
      />
    );
  }

  if (draft) {
    const valid = Boolean(
      draft.key.trim() &&
        draft.name.trim() &&
        draft.fields.some((f) => f.key.trim() && f.label.trim()),
    );
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
            <Button
              size="sm"
              onClick={onSave}
              disabled={save.isPending || !valid}
            >
              {save.isPending
                ? t('common.saving', 'Saving…')
                : t('adminIntel.schema.saveVersion', 'Save (new version)')}
            </Button>
          </div>
        </div>
        {!valid && (
          <p className="text-xs text-warning-foreground">
            {t(
              'adminIntel.schema.invalid',
              'A key, a name, and at least one field (with key + label) are required.',
            )}
          </p>
        )}

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
            <Card
              key={i}
              className={`p-3 space-y-2 ${
                f.isActive === false ? 'opacity-60' : ''
              }`}
            >
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
                <Select
                  value={f.type}
                  onValueChange={(v) =>
                    setField(i, { type: v as AdminFieldType })
                  }
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ty) => (
                      <SelectItem key={ty} value={ty}>
                        {ty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <label className="flex items-center gap-1.5">
                  <Checkbox
                    checked={f.isActive !== false}
                    onCheckedChange={(v) => setField(i, { isActive: Boolean(v) })}
                  />
                  {t('adminIntel.schema.fieldEnabled', 'Enabled')}
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

  const onDelete = async (key: string) => {
    const ok = await confirm({
      title: t('adminIntel.schema.deleteTitle', 'Delete type permanently?'),
      description: t(
        'adminIntel.schema.deleteDesc',
        'This removes the type and all its versions for good. Prefer Disable if you might need it again.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) purge.mutate(key);
  };

  const columns: DataTableColumn<AdminSchemaSummary>[] = [
    {
      key: 'name',
      header: t('adminIntel.schema.colName', 'Type'),
      sortValue: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium text-foreground',
              s.isActive === false && 'text-foreground/50',
            )}
          >
            {s.name}
          </span>
          {!s.documentTypeKey && (
            <Badge variant="info">
              {t('adminIntel.schema.readOnly', 'read-only')}
            </Badge>
          )}
          {s.isActive === false && (
            <Badge variant="secondary">
              {t('adminIntel.schema.disabled', 'disabled')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'key',
      header: t('adminIntel.schema.colKey', 'Key'),
      sortValue: (s) => s.key,
      cell: (s) => <span className="text-foreground/55">{s.key}</span>,
    },
    {
      key: 'version',
      header: t('adminIntel.schema.colVersion', 'Ver'),
      align: 'right',
      sortValue: (s) => s.version,
      cell: (s) => <span className="tabular-nums text-foreground/60">v{s.version}</span>,
    },
    {
      key: 'fields',
      header: t('adminIntel.schema.colFields', 'Fields'),
      align: 'right',
      sortValue: (s) => s.fieldCount,
      cell: (s) => <span className="tabular-nums">{s.fieldCount}</span>,
    },
    {
      key: 'updated',
      header: t('common.updated', 'Updated'),
      sortValue: (s) => s.updatedAt,
      cell: (s) => (
        <span className="text-foreground/55">
          {new Date(s.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton title={t('common.edit', 'Edit')} onClick={() => startEdit(s.key)}>
            <EditIcon />
          </IconButton>
          {s.documentTypeKey && (
            <IconButton
              title={t('adminIntel.schema.mapping', 'Field mapping')}
              onClick={() => setMappingKey(s.key)}
            >
              <MapIcon />
            </IconButton>
          )}
          <IconButton
            title={t('common.clone', 'Clone')}
            onClick={() => startClone(s.key)}
          >
            <CopyIcon />
          </IconButton>
          {s.isActive === false ? (
            <IconButton
              title={t('adminIntel.schema.enable', 'Enable')}
              disabled={setActive.isPending}
              onClick={() => setActive.mutate({ key: s.key, active: true })}
            >
              <EyeOffIcon />
            </IconButton>
          ) : (
            <IconButton
              title={t('adminIntel.schema.disable', 'Disable')}
              disabled={setActive.isPending}
              onClick={() => setActive.mutate({ key: s.key, active: false })}
            >
              <EyeIcon />
            </IconButton>
          )}
          <IconButton
            danger
            title={t('common.delete', 'Delete')}
            disabled={purge.isPending}
            onClick={() => onDelete(s.key)}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ),
    },
  ];

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
        <DataTable
          data={schemas ?? []}
          columns={columns}
          rowKey={(s) => s.key}
          search={(s) => `${s.name} ${s.key}`}
          searchPlaceholder={t('adminIntel.schema.search', 'Search types…')}
          initialSort={{ key: 'name', dir: 'asc' }}
          renderExpanded={(s) => <ExpandedSchema schemaKey={s.key} />}
          toolbar={
            <label className="flex items-center gap-1.5 text-xs text-foreground/60">
              <Checkbox
                checked={showDisabled}
                onCheckedChange={(v) => setShowDisabled(Boolean(v))}
              />
              {t('adminIntel.schema.showDisabled', 'Show disabled')}
            </label>
          }
          empty={t('adminIntel.schema.empty', 'No document types yet.')}
        />
      )}
    </div>
  );
}

/** Expanded-row preview: the schema's fields as compact chips (lazy-loaded). */
function ExpandedSchema({ schemaKey }: { schemaKey: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSchema(schemaKey);
  if (isLoading || !data) {
    return (
      <p className="text-xs text-foreground/50">{t('common.loading', 'Loading…')}</p>
    );
  }
  if (data.fields.length === 0) {
    return (
      <p className="text-xs text-foreground/50">
        {t('adminIntel.schema.noFields', 'No fields.')}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {data.fields.map((f) => (
        <span
          key={f.key}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
            f.isActive === false
              ? 'border-dashed border-border opacity-50'
              : 'border-border',
          )}
          title={f.key}
        >
          <span className="font-medium text-foreground">{f.label}</span>
          <span className="text-foreground/40">{f.type}</span>
          {f.required && <span className="text-error">*</span>}
        </span>
      ))}
    </div>
  );
}
