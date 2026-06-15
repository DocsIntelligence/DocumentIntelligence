import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AdminSchemaDetail,
  AdminSchemaSummary,
  UpsertSchemaPayload,
} from '@org/api-client';
import {
  extractionSchemaSchema,
  type ExtractionSchemaDto,
  type FieldType,
} from '@org/dto';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type DataTableColumn,
} from '@org/ui';
import { cn } from '@org/utils';
import { useState } from 'react';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
  type Resolver,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { applyServerFieldErrors } from '../../../lib/server-errors';
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

const FIELD_TYPES: FieldType[] = [
  'string',
  'number',
  'currency',
  'date',
  'boolean',
  'enum',
  'table',
];

type FieldValue = ExtractionSchemaDto['fields'][number];

const blankField = (): FieldValue => ({
  key: '',
  label: '',
  type: 'string',
  required: false,
  reviewMandatory: false,
  isActive: true,
  description: '',
  example: '',
  format: '',
  enumValues: [],
});

export const blankSchema = (): ExtractionSchemaDto => ({
  key: '',
  name: '',
  documentTypeKey: '',
  description: '',
  jurisdiction: '',
  fields: [blankField()],
});

/** DB detail → form values (null → '' / [] so inputs stay controlled). */
export function detailToForm(
  d: AdminSchemaDetail,
  clone: boolean,
): ExtractionSchemaDto {
  return {
    key: clone ? `${d.key}_copy` : d.key,
    name: clone ? `${d.name} (copy)` : d.name,
    documentTypeKey: clone ? '' : (d.documentTypeKey ?? ''),
    description: d.description ?? '',
    jurisdiction: d.jurisdiction ?? '',
    fields: d.fields.length
      ? d.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: Boolean(f.required),
          reviewMandatory: Boolean(f.reviewMandatory),
          isActive: f.isActive !== false,
          fieldThreshold: f.fieldThreshold ?? undefined,
          description: f.description ?? '',
          example: f.example ?? '',
          format: f.format ?? '',
          enumValues: f.enumValues ?? [],
        }))
      : [blankField()],
  };
}

/** Validated form values → API payload (trim, empty → undefined/null). */
function toPayload(v: ExtractionSchemaDto): UpsertSchemaPayload {
  return {
    key: v.key.trim(),
    name: v.name.trim(),
    documentTypeKey: v.documentTypeKey?.trim()
      ? v.documentTypeKey.trim()
      : null,
    description: v.description?.trim() || undefined,
    jurisdiction: v.jurisdiction?.trim() || undefined,
    fields: v.fields.map((f) => ({
      key: f.key.trim(),
      label: f.label.trim(),
      type: f.type,
      required: f.required,
      reviewMandatory: f.reviewMandatory,
      isActive: f.isActive,
      fieldThreshold: f.fieldThreshold ?? undefined,
      description: f.description?.trim() || undefined,
      example: f.example?.trim() || undefined,
      format: f.format?.trim() || undefined,
      enumValues:
        f.type === 'enum' ? (f.enumValues ?? []).filter(Boolean) : undefined,
    })),
  };
}

/**
 * Admin schema editor (docs/07 P4.2). Lists authored extraction schemas and
 * edits one's fields as config-as-data. Saving an existing schema mints a new
 * immutable version server-side. Validation is shared with the API via the
 * `@org/dto` Zod schema (react-hook-form + zodResolver).
 */
export function SchemaManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [showDisabled, setShowDisabled] = useState(false);
  const { data: schemas, isLoading } = useSchemas(showDisabled);
  const purge = usePurgeSchema();
  const setActive = useSetSchemaActive();

  const startCreate = () => navigate('/config/document-types/new');
  const startEdit = (key: string) =>
    navigate(`/config/document-types/${encodeURIComponent(key)}/edit`);
  const startClone = (key: string) =>
    navigate(`/config/document-types/${encodeURIComponent(key)}/clone`);
  const openMapping = (key: string) =>
    navigate(`/config/document-types/${encodeURIComponent(key)}/mapping`);

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

  const onToggleActive = async (key: string, currentlyActive: boolean) => {
    const ok = await confirm({
      title: currentlyActive
        ? t('adminIntel.schema.disableTitle', 'Disable this type?')
        : t('adminIntel.schema.enableTitle', 'Enable this type?'),
      description: currentlyActive
        ? t(
            'adminIntel.schema.disableDesc',
            'It will be hidden from new extractions but existing data is kept. You can re-enable it later.',
          )
        : t(
            'adminIntel.schema.enableDesc',
            'It will be available for new extractions again.',
          ),
      confirmLabel: currentlyActive
        ? t('adminIntel.schema.disable', 'Disable')
        : t('adminIntel.schema.enable', 'Enable'),
    });
    if (ok) setActive.mutate({ key, active: !currentlyActive });
  };

  const columns: DataTableColumn<AdminSchemaSummary>[] = [
    {
      key: 'name',
      header: t('adminIntel.schema.colName', 'Type'),
      defaultWidth: 320,
      sortValue: (s) => s.name.toLowerCase(),
      cell: (s) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="inline-flex size-8 flex-none items-center justify-center rounded-lg bg-secondary/60 text-foreground/70">
            <DocIcon />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                'truncate font-medium text-foreground',
                s.isActive === false && 'text-foreground/50',
              )}
            >
              {s.name}
            </p>
            <p className="truncate font-mono text-xs text-foreground/45">
              {s.key}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'docType',
      header: t('adminIntel.schema.colDocType', 'Drafting type'),
      defaultWidth: 180,
      sortValue: (s) => s.documentTypeKey ?? '',
      cell: (s) =>
        s.documentTypeKey ? (
          <Badge variant="secondary" outline>
            {s.documentTypeKey}
          </Badge>
        ) : (
          <Badge variant="info" outline>
            {t('adminIntel.schema.readOnly', 'read-only')}
          </Badge>
        ),
    },
    {
      key: 'status',
      header: t('common.status', 'Status'),
      defaultWidth: 110,
      sortValue: (s) => (s.isActive === false ? 0 : 1),
      cell: (s) =>
        s.isActive === false ? (
          <Badge variant="secondary">
            {t('adminIntel.schema.disabled', 'Disabled')}
          </Badge>
        ) : (
          <Badge variant="success">
            {t('adminIntel.schema.enabled', 'Active')}
          </Badge>
        ),
    },
    {
      key: 'fields',
      header: t('adminIntel.schema.colFields', 'Fields'),
      align: 'right',
      defaultWidth: 80,
      sortValue: (s) => s.fieldCount,
      cell: (s) => <span className="tabular-nums">{s.fieldCount}</span>,
    },
    {
      key: 'version',
      header: t('adminIntel.schema.colVersion', 'Ver'),
      align: 'right',
      defaultWidth: 70,
      sortValue: (s) => s.version,
      cell: (s) => (
        <span className="tabular-nums text-foreground/60">v{s.version}</span>
      ),
    },
    {
      key: 'updated',
      header: t('common.updated', 'Updated'),
      defaultWidth: 110,
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
      width: 'w-52',
      pinned: true,
      cell: (s) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            title={t('common.edit', 'Edit')}
            onClick={() => startEdit(s.key)}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            title={t('common.clone', 'Clone')}
            onClick={() => startClone(s.key)}
          >
            <CopyIcon />
          </IconButton>
          {s.documentTypeKey && (
            <IconButton
              title={t('adminIntel.schema.mapping', 'Field mapping')}
              onClick={() => openMapping(s.key)}
            >
              <MapIcon />
            </IconButton>
          )}
          {s.isActive === false ? (
            <IconButton
              title={t('adminIntel.schema.enable', 'Enable')}
              disabled={setActive.isPending}
              onClick={() => onToggleActive(s.key, false)}
            >
              <EyeOffIcon />
            </IconButton>
          ) : (
            <IconButton
              title={t('adminIntel.schema.disable', 'Disable')}
              disabled={setActive.isPending}
              onClick={() => onToggleActive(s.key, true)}
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

  const total = schemas?.length ?? 0;
  const activeCount = schemas?.filter((s) => s.isActive !== false).length ?? 0;

  return (
    <div className="space-y-5">
      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={t('adminIntel.schema.totalTypes', 'Total types')}
          value={total}
        />
        <StatTile
          label={t('adminIntel.schema.active', 'Active')}
          value={activeCount}
          tone="success"
        />
        <StatTile
          label={t('adminIntel.schema.disabledCount', 'Disabled')}
          value={total - activeCount}
          tone="muted"
        />
        <StatTile
          label={t('adminIntel.schema.readOnlyCount', 'Read-only')}
          value={schemas?.filter((s) => !s.documentTypeKey).length ?? 0}
          tone="info"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t('adminIntel.schema.listTitle', 'All document types')}
          </h3>
          <p className="mt-0.5 text-xs text-foreground/55">
            {t(
              'adminIntel.schema.listHint',
              'Read-only types are still classified and extracted, just not draftable.',
            )}
          </p>
        </div>
        <Button onClick={startCreate}>
          {t('adminIntel.schema.create', '+ New type')}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-secondary/40"
            />
          ))}
        </div>
      ) : (
        <DataTable
          tableId="admin.intelligence.schemas"
          data={schemas ?? []}
          columns={columns}
          rowKey={(s) => s.key}
          search={(s) => `${s.name} ${s.key} ${s.documentTypeKey ?? ''}`}
          searchPlaceholder={t(
            'adminIntel.schema.search',
            'Search types by name, key, or drafting type…',
          )}
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
          empty={
            <div className="space-y-3 py-6">
              <p className="text-sm text-foreground/60">
                {t('adminIntel.schema.empty', 'No document types yet.')}
              </p>
              <Button size="sm" onClick={startCreate}>
                {t('adminIntel.schema.create', '+ New type')}
              </Button>
            </div>
          }
        />
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'muted' | 'info';
}) {
  const toneClass: Record<string, string> = {
    default: 'text-foreground',
    success: 'text-success',
    muted: 'text-foreground/50',
    info: 'text-info',
  };
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <p
        className={cn(
          'text-2xl font-semibold leading-none tabular-nums',
          toneClass[tone],
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-foreground/55">{label}</p>
    </div>
  );
}

function DocIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

/** The create/edit form — its own `useForm` so defaults init per edit session. */
export function SchemaEditor({
  initial,
  creating,
  onClose,
}: {
  initial: ExtractionSchemaDto;
  creating: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const save = useSaveSchema();
  const form = useForm<ExtractionSchemaDto>({
    // Cast: Zod's input type (optional `.default()` fields + the recursive
    // `z.lazy` field) diverges from the output type RHF works with. zodResolver
    // validates against the real schema and hands RHF parsed (output) values.
    resolver: zodResolver(
      extractionSchemaSchema,
    ) as Resolver<ExtractionSchemaDto>,
    defaultValues: initial,
    mode: 'onBlur',
  });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'fields',
  });

  const onSubmit = handleSubmit((values) => {
    save.mutate(
      { exists: !creating, payload: toPayload(values) },
      {
        onSuccess: onClose,
        onError: (err) => applyServerFieldErrors(err, setError),
      },
    );
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h4 className="text-sm font-medium text-foreground">
            {creating
              ? t('adminIntel.schema.newType', 'New extraction type')
              : t('adminIntel.schema.editType', 'Edit extraction type')}
          </h4>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('common.back', 'Back to types')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending
                ? t('common.saving', 'Saving…')
                : creating
                  ? t('adminIntel.schema.create', '+ New type')
                  : t('adminIntel.schema.saveVersion', 'Save (new version)')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label={t('adminIntel.schema.key', 'Key (stable id)')}
            error={errors.key?.message}
          >
            <Input
              placeholder="contractor_agreement"
              disabled={!creating}
              hasError={!!errors.key}
              {...register('key')}
            />
          </FormField>
          <FormField
            label={t('adminIntel.schema.name', 'Display name')}
            error={errors.name?.message}
          >
            <Input
              placeholder="Contractor Agreement"
              hasError={!!errors.name}
              {...register('name')}
            />
          </FormField>
          <FormField
            label={t(
              'adminIntel.schema.docTypeKey',
              'Drafting type key (optional)',
            )}
            error={errors.documentTypeKey?.message}
          >
            <Input
              placeholder="(leave blank for read-only types)"
              hasError={!!errors.documentTypeKey}
              {...register('documentTypeKey')}
            />
          </FormField>
          <FormField
            label={t(
              'adminIntel.schema.jurisdiction',
              'Jurisdiction (optional)',
            )}
            error={errors.jurisdiction?.message}
          >
            <Input
              placeholder="IN-MH"
              hasError={!!errors.jurisdiction}
              {...register('jurisdiction')}
            />
          </FormField>
        </div>
        <FormField
          label={t('adminIntel.schema.description', 'Description')}
          error={errors.description?.message}
        >
          <Input hasError={!!errors.description} {...register('description')} />
        </FormField>

        <div className="flex items-center justify-between pt-2">
          <h4 className="font-medium text-foreground">
            {t('adminIntel.schema.fields', 'Fields')}
          </h4>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => append(blankField())}
          >
            {t('adminIntel.schema.addField', '+ Add field')}
          </Button>
        </div>

        {typeof errors.fields?.message === 'string' && (
          <p className="text-xs text-error">{errors.fields.message}</p>
        )}

        <div className="space-y-2">
          {fields.map((field, i) => (
            <FieldRow
              key={field.id}
              index={i}
              canUp={i > 0}
              canDown={i < fields.length - 1}
              onUp={() => move(i, i - 1)}
              onDown={() => move(i, i + 1)}
              onRemove={() => remove(i)}
            />
          ))}
        </div>
      </form>
    </FormProvider>
  );
}

/** One field row of the schema editor. Reads the shared form via context. */
function FieldRow({
  index,
  canUp,
  canDown,
  onUp,
  onDown,
  onRemove,
}: {
  index: number;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ExtractionSchemaDto>();
  const type = useWatch({ control, name: `fields.${index}.type` });
  const isActive = useWatch({ control, name: `fields.${index}.isActive` });
  const err = errors.fields?.[index];

  return (
    <Card className={cn('p-3 space-y-2', isActive === false && 'opacity-60')}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="space-y-1">
          <Input
            placeholder={t('adminIntel.schema.fieldKey', 'field_key')}
            hasError={!!err?.key}
            {...register(`fields.${index}.key`)}
          />
          {err?.key?.message && (
            <span className="text-xs text-error">{err.key.message}</span>
          )}
        </div>
        <div className="space-y-1">
          <Input
            placeholder={t('adminIntel.schema.fieldLabel', 'Label')}
            hasError={!!err?.label}
            {...register(`fields.${index}.label`)}
          />
          {err?.label?.message && (
            <span className="text-xs text-error">{err.label.message}</span>
          )}
        </div>
        <Controller
          control={control}
          name={`fields.${index}.type`}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
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
          )}
        />
      </div>

      {type === 'enum' && (
        <Controller
          control={control}
          name={`fields.${index}.enumValues`}
          render={({ field }) => (
            <Input
              value={(field.value ?? []).join(', ')}
              placeholder={t(
                'adminIntel.schema.enumValues',
                'Allowed values (comma-separated)',
              )}
              onChange={(e) =>
                field.onChange(
                  e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
            />
          )}
        />
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Controller
          control={control}
          name={`fields.${index}.required`}
          render={({ field }) => (
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={Boolean(field.value)}
                onCheckedChange={(v) => field.onChange(Boolean(v))}
              />
              {t('adminIntel.schema.required', 'Required')}
            </label>
          )}
        />
        <Controller
          control={control}
          name={`fields.${index}.reviewMandatory`}
          render={({ field }) => (
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={Boolean(field.value)}
                onCheckedChange={(v) => field.onChange(Boolean(v))}
              />
              {t('adminIntel.schema.reviewMandatory', 'Always review')}
            </label>
          )}
        />
        <Controller
          control={control}
          name={`fields.${index}.isActive`}
          render={({ field }) => (
            <label className="flex items-center gap-1.5">
              <Checkbox
                checked={field.value !== false}
                onCheckedChange={(v) => field.onChange(Boolean(v))}
              />
              {t('adminIntel.schema.fieldEnabled', 'Enabled')}
            </label>
          )}
        />
        <Input
          className="w-32"
          placeholder={t('adminIntel.schema.format', 'format')}
          {...register(`fields.${index}.format`)}
        />
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!canUp}
            onClick={onUp}
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!canDown}
            onClick={onDown}
          >
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-error"
            onClick={onRemove}
          >
            ✕
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Expanded-row preview: the schema's fields as compact chips (lazy-loaded). */
function ExpandedSchema({ schemaKey }: { schemaKey: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSchema(schemaKey);
  if (isLoading || !data) {
    return (
      <p className="text-xs text-foreground/50">
        {t('common.loading', 'Loading…')}
      </p>
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
