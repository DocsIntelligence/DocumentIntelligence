import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminPipelineSummary } from '@org/api-client';
import {
  pipelineSchema,
  type PipelineDto,
  type StageConfig,
  type StageType,
} from '@org/dto';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  TrashIcon,
} from './icons';
import {
  usePipeline,
  usePipelines,
  usePurgePipeline,
  useSavePipeline,
  useSchemas,
  useSetPipelineActive,
} from './queries';

type StageValue = PipelineDto['stages'][number];

const STAGE_TYPES: StageType[] = [
  'ingest',
  'classify',
  'filter',
  'extract',
  'validate',
  'review',
  'export',
];

// Sentinel for the "force type" Select — Radix forbids an empty-string item
// value, so this stands in for "use the classified type" (→ schemaKey undefined).
const CLASSIFIED = '__classified__';

const STAGE_HELP: Record<StageType, string> = {
  ingest: 'Parse the file to text (fast path for extraction).',
  classify: 'Identify the document type.',
  filter: 'Keep only the wanted types; archive the rest (no extraction).',
  extract: 'Pull the schema fields out of the document.',
  validate: 'Auto-advance when confidence clears the thresholds, else park.',
  review: 'Always pause for a human (manual interruption).',
  export: 'Convert the reviewed extraction into a structured document.',
};

const defaultStage = (type: StageType): StageValue => ({
  type,
  name: type.charAt(0).toUpperCase() + type.slice(1),
  config:
    type === 'validate'
      ? {
          autoAdvance: {
            minOverall: 0.9,
            minField: 0.85,
            requireAllRequired: true,
            onFail: 'review',
          },
        }
      : type === 'extract'
        ? { engineMode: 'auto' }
        : type === 'export'
          ? { targets: ['structured_document'] }
          : type === 'filter'
            ? { onUnmatched: 'archive', allowedTypes: [] }
            : {},
});

export const blankPipeline = (): PipelineDto => ({
  key: '',
  name: '',
  stages: [
    defaultStage('ingest'),
    defaultStage('classify'),
    defaultStage('filter'),
    defaultStage('extract'),
    defaultStage('validate'),
    defaultStage('export'),
  ],
});

function toPayload(v: PipelineDto): { key: string; name: string; stages: StageValue[] } {
  return {
    key: v.key.trim(),
    name: v.name.trim(),
    stages: v.stages.map((s) => ({
      type: s.type,
      name: s.name.trim() || s.type,
      config: s.config ?? {},
    })),
  };
}

/**
 * Admin pipeline editor (docs/07 P4.2): compose an ordered, typed stage list
 * (e.g. classify → review → extract → review → export), with per-stage config.
 * Validation is shared with the API via the `@org/dto` Zod schema
 * (react-hook-form + zodResolver). Saving mints a new immutable version.
 */
/** Build a form value from a loaded pipeline (used for edit + clone). */
export function pipelineDetailToForm(
  loaded: { key: string; name: string; stages: StageValue[] },
  clone: boolean,
): PipelineDto {
  return {
    key: clone ? `${loaded.key}_copy` : loaded.key,
    name: clone ? `${loaded.name} (copy)` : loaded.name,
    stages: loaded.stages.map((s) => ({
      type: s.type,
      name: s.name,
      config: { ...s.config },
    })),
  };
}

export function PipelineManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [showDisabled, setShowDisabled] = useState(false);
  const { data: pipelines, isLoading } = usePipelines(showDisabled);
  const setActive = useSetPipelineActive();
  const purge = usePurgePipeline();

  const startCreate = () => navigate('/admin/intelligence/pipelines/new');
  const startEdit = (key: string) =>
    navigate(`/admin/intelligence/pipelines/${encodeURIComponent(key)}/edit`);
  const startClone = (key: string) =>
    navigate(`/admin/intelligence/pipelines/${encodeURIComponent(key)}/clone`);

  const onDelete = async (key: string) => {
    const ok = await confirm({
      title: t('adminIntel.pipeline.deleteTitle', 'Delete pipeline permanently?'),
      description: t(
        'adminIntel.pipeline.deleteDesc',
        'Removes the pipeline and all its versions for good. Refused if any run used it — disable instead. Prefer Disable to keep history.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) purge.mutate(key);
  };

  const onToggleActive = async (key: string, currentlyActive: boolean) => {
    const ok = await confirm({
      title: currentlyActive
        ? t('adminIntel.pipeline.disableTitle', 'Disable this pipeline?')
        : t('adminIntel.pipeline.enableTitle', 'Enable this pipeline?'),
      description: currentlyActive
        ? t(
            'adminIntel.pipeline.disableDesc',
            'It will be hidden from new runs but kept for history. You can re-enable it later.',
          )
        : t(
            'adminIntel.pipeline.enableDesc',
            'It will be available for new runs again.',
          ),
      confirmLabel: currentlyActive
        ? t('adminIntel.pipeline.disable', 'Disable')
        : t('adminIntel.pipeline.enable', 'Enable'),
    });
    if (ok) setActive.mutate({ key, active: !currentlyActive });
  };

  const columns: DataTableColumn<AdminPipelineSummary>[] = [
    {
      key: 'name',
      header: t('adminIntel.pipeline.colName', 'Pipeline'),
      sortValue: (p) => p.name.toLowerCase(),
      cell: (p) => (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium text-foreground',
              p.isActive === false && 'text-foreground/50',
            )}
          >
            {p.name}
          </span>
          {p.isActive === false && (
            <Badge variant="secondary">
              {t('adminIntel.pipeline.disabled', 'disabled')}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'key',
      header: t('adminIntel.pipeline.colKey', 'Key'),
      sortValue: (p) => p.key,
      cell: (p) => <span className="text-foreground/55">{p.key}</span>,
    },
    {
      key: 'version',
      header: t('adminIntel.pipeline.colVersion', 'Ver'),
      align: 'right',
      sortValue: (p) => p.version,
      cell: (p) => (
        <span className="tabular-nums text-foreground/60">v{p.version}</span>
      ),
    },
    {
      key: 'stages',
      header: t('adminIntel.pipeline.colStages', 'Stages'),
      align: 'right',
      sortValue: (p) => p.stageCount,
      cell: (p) => <span className="tabular-nums">{p.stageCount}</span>,
    },
    {
      key: 'updated',
      header: t('common.updated', 'Updated'),
      sortValue: (p) => p.updatedAt,
      cell: (p) => (
        <span className="text-foreground/55">
          {new Date(p.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-40',
      pinned: true,
      cell: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            title={t('common.edit', 'Edit')}
            onClick={() => startEdit(p.key)}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            title={t('common.clone', 'Clone')}
            onClick={() => startClone(p.key)}
          >
            <CopyIcon />
          </IconButton>
          {p.isActive === false ? (
            <IconButton
              title={t('adminIntel.pipeline.enable', 'Enable')}
              disabled={setActive.isPending}
              onClick={() => onToggleActive(p.key, false)}
            >
              <EyeOffIcon />
            </IconButton>
          ) : (
            <IconButton
              title={t('adminIntel.pipeline.disable', 'Disable')}
              disabled={setActive.isPending}
              onClick={() => onToggleActive(p.key, true)}
            >
              <EyeIcon />
            </IconButton>
          )}
          <IconButton
            danger
            title={t('common.delete', 'Delete')}
            disabled={purge.isPending}
            onClick={() => onDelete(p.key)}
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
            'adminIntel.pipeline.intro',
            'Compose the processing flow: order the stages, set auto-advance confidence, and drop in manual-review gates wherever you want a human to check.',
          )}
        </p>
        <Button size="sm" onClick={startCreate}>
          {t('adminIntel.pipeline.create', '+ New pipeline')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-foreground/60 text-sm">
          {t('common.loading', 'Loading…')}
        </p>
      ) : (
        <DataTable
          tableId="admin.intelligence.pipelines"
          data={pipelines ?? []}
          columns={columns}
          rowKey={(p) => p.key}
          search={(p) => `${p.name} ${p.key}`}
          searchPlaceholder={t('adminIntel.pipeline.search', 'Search pipelines…')}
          initialSort={{ key: 'name', dir: 'asc' }}
          renderExpanded={(p) => <ExpandedPipeline pipelineKey={p.key} />}
          toolbar={
            <label className="flex items-center gap-1.5 text-xs text-foreground/60">
              <Checkbox
                checked={showDisabled}
                onCheckedChange={(v) => setShowDisabled(Boolean(v))}
              />
              {t('adminIntel.pipeline.showDisabled', 'Show disabled')}
            </label>
          }
          empty={t(
            'adminIntel.pipeline.empty',
            'No pipelines yet. Create one to define a custom flow.',
          )}
        />
      )}
    </div>
  );
}

/** The create/edit pipeline form. Its own `useForm` per edit session. */
export function PipelineEditor({
  initial,
  creating,
  onClose,
}: {
  initial: PipelineDto;
  creating: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const save = useSavePipeline();
  const form = useForm<PipelineDto>({
    // Cast: Zod's input type (optional `.default()` config) diverges from the
    // output type RHF works with. zodResolver still validates the real schema.
    resolver: zodResolver(pipelineSchema) as Resolver<PipelineDto>,
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
    name: 'stages',
  });

  const stages = useWatch({ control, name: 'stages' }) ?? [];
  const types = stages.map((s) => s.type);
  const warnings: string[] = [];
  if (!types.includes('extract'))
    warnings.push(
      t(
        'adminIntel.pipeline.warnNoExtract',
        'No extract stage — nothing will be pulled out of the document.',
      ),
    );
  if (!types.includes('classify') && !stages.some((s) => s.config?.schemaKey))
    warnings.push(
      t(
        'adminIntel.pipeline.warnNoType',
        'No classify stage and no forced type on extract — the generic schema will be used.',
      ),
    );
  if (types.includes('extract') && !types.includes('ingest'))
    warnings.push(
      t(
        'adminIntel.pipeline.warnNoIngest',
        'No ingest stage — text-layer files skip the fast path and use vision/agentic.',
      ),
    );
  if (
    stages.some(
      (s) => s.type === 'filter' && !(s.config?.allowedTypes ?? []).length,
    )
  )
    warnings.push(
      t(
        'adminIntel.pipeline.warnEmptyFilter',
        'A filter stage has no types selected — it keeps everything (archives nothing).',
      ),
    );
  if (
    types.indexOf('filter') >= 0 &&
    types.indexOf('filter') < types.indexOf('classify')
  )
    warnings.push(
      t(
        'adminIntel.pipeline.warnFilterBeforeClassify',
        'Filter runs before classify — it has no type to check yet. Put classify first.',
      ),
    );

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
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common.back', 'Back to pipelines')}
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending
              ? t('common.saving', 'Saving…')
              : creating
              ? t('adminIntel.pipeline.create', '+ New pipeline')
              : t('adminIntel.pipeline.saveVersion', 'Save (new version)')}
          </Button>
        </div>

        {warnings.length > 0 && (
          <ul className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground space-y-1">
            {warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label={t('adminIntel.pipeline.key', 'Key (stable id)')}
            error={errors.key?.message}
          >
            <Input
              placeholder="contracts_review"
              disabled={!creating}
              hasError={!!errors.key}
              {...register('key')}
            />
          </FormField>
          <FormField
            label={t('adminIntel.pipeline.name', 'Display name')}
            error={errors.name?.message}
          >
            <Input
              placeholder="Contracts (with double review)"
              hasError={!!errors.name}
              {...register('name')}
            />
          </FormField>
        </div>

        <div className="flex items-center justify-between pt-2">
          <h4 className="font-medium text-foreground">
            {t('adminIntel.pipeline.stages', 'Stages (run top to bottom)')}
          </h4>
        </div>

        {typeof errors.stages?.message === 'string' && (
          <p className="text-xs text-error">{errors.stages.message}</p>
        )}

        <div className="space-y-2">
          {fields.map((field, i) => (
            <StageCard
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {t('adminIntel.pipeline.addStage', '+ Add stage…')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STAGE_TYPES.map((ty) => (
              <DropdownMenuItem key={ty} onSelect={() => append(defaultStage(ty))}>
                {ty}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </form>
    </FormProvider>
  );
}

/** One stage row + its per-type config. Reads the shared form via context. */
function StageCard({
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
  const { data: schemas } = useSchemas();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<PipelineDto>();
  const type = useWatch({ control, name: `stages.${index}.type` });
  const config = (useWatch({ control, name: `stages.${index}.config` }) ??
    {}) as StageConfig;
  const nameErr = errors.stages?.[index]?.name?.message;

  const setConfig = (patch: Partial<StageConfig>) =>
    setValue(`stages.${index}.config`, { ...config, ...patch });

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-foreground/40 w-5">{index + 1}</span>
        <Controller
          control={control}
          name={`stages.${index}.type`}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                // reset config to the new type's defaults (keep the name)
                setValue(
                  `stages.${index}.config`,
                  defaultStage(v as StageType).config,
                );
              }}
            >
              <SelectTrigger className="w-auto text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_TYPES.map((ty) => (
                  <SelectItem key={ty} value={ty}>
                    {ty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <div className="flex-1">
          <Input
            hasError={!!errors.stages?.[index]?.name}
            {...register(`stages.${index}.name`)}
          />
          {nameErr && <span className="text-xs text-error">{nameErr}</span>}
        </div>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" disabled={!canUp} onClick={onUp}>
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
      <p className="text-xs text-foreground/50">{STAGE_HELP[type]}</p>

      {type === 'classify' && (
        <div className="text-sm">
          <span className="text-foreground/60">
            {t(
              'adminIntel.pipeline.candidateKeys',
              'Restrict to these types (none = all):',
            )}
          </span>
          <div className="flex flex-wrap gap-3 mt-1">
            {(schemas ?? []).map((sc) => {
              const checked = (config.candidateKeys ?? []).includes(sc.key);
              return (
                <label key={sc.key} className="flex items-center gap-1.5">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const set = new Set(config.candidateKeys ?? []);
                      if (v) set.add(sc.key);
                      else set.delete(sc.key);
                      setConfig({
                        candidateKeys: set.size ? [...set] : undefined,
                      });
                    }}
                  />
                  {sc.key}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {type === 'filter' && (
        <div className="space-y-2 text-sm">
          <span className="text-foreground/60">
            {t(
              'adminIntel.pipeline.allowedTypes',
              'Keep only these types (archive the rest):',
            )}
          </span>
          <div className="flex flex-wrap gap-3">
            {(schemas ?? []).map((sc) => {
              const checked = (config.allowedTypes ?? []).includes(sc.key);
              return (
                <label key={sc.key} className="flex items-center gap-1.5">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      const set = new Set(config.allowedTypes ?? []);
                      if (v) set.add(sc.key);
                      else set.delete(sc.key);
                      setConfig({ allowedTypes: [...set] });
                    }}
                  />
                  {sc.key}
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span className="text-foreground/60">
                {t('adminIntel.pipeline.minConfidence', 'Min confidence')}
              </span>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                className="w-20"
                value={config.minConfidence ?? 0}
                onChange={(e) =>
                  setConfig({ minConfidence: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-foreground/60">
                {t('adminIntel.pipeline.onUnmatched', 'Out-of-scope →')}
              </span>
              <Select
                value={config.onUnmatched ?? 'archive'}
                onValueChange={(v) =>
                  setConfig({
                    onUnmatched: v as 'archive' | 'reject' | 'review',
                  })
                }
              >
                <SelectTrigger className="w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="archive">archive</SelectItem>
                  <SelectItem value="reject">reject</SelectItem>
                  <SelectItem value="review">review</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        </div>
      )}

      {type === 'extract' && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <span className="text-foreground/60">
              {t('adminIntel.pipeline.engineMode', 'Engine')}
            </span>
            <Select
              value={config.engineMode ?? 'auto'}
              onValueChange={(v) =>
                setConfig({ engineMode: v as StageConfig['engineMode'] })
              }
            >
              <SelectTrigger className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['auto', 'native', 'vlm', 'agentic'].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-foreground/60">
              {t('adminIntel.pipeline.pinSchema', 'Force type')}
            </span>
            <Select
              value={config.schemaKey ?? CLASSIFIED}
              onValueChange={(v) =>
                setConfig({ schemaKey: v === CLASSIFIED ? undefined : v })
              }
            >
              <SelectTrigger className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLASSIFIED}>
                  {t('adminIntel.pipeline.useClassified', '(use classified)')}
                </SelectItem>
                {(schemas ?? []).map((sc) => (
                  <SelectItem key={sc.key} value={sc.key}>
                    {sc.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      )}

      {type === 'validate' && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <span className="text-foreground/60">
              {t('adminIntel.pipeline.minOverall', 'Min overall')}
            </span>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="w-20"
              value={config.autoAdvance?.minOverall ?? 0.9}
              onChange={(e) =>
                setConfig({
                  autoAdvance: {
                    ...config.autoAdvance,
                    minOverall: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-foreground/60">
              {t('adminIntel.pipeline.minField', 'Min per-field')}
            </span>
            <Input
              type="number"
              step="0.05"
              min="0"
              max="1"
              className="w-20"
              value={config.autoAdvance?.minField ?? 0.85}
              onChange={(e) =>
                setConfig({
                  autoAdvance: {
                    ...config.autoAdvance,
                    minField: Number(e.target.value),
                  },
                })
              }
            />
          </label>
          <label className="flex items-center gap-1.5">
            <Checkbox
              checked={Boolean(config.autoAdvance?.requireAllRequired)}
              onCheckedChange={(v) =>
                setConfig({
                  autoAdvance: {
                    ...config.autoAdvance,
                    requireAllRequired: Boolean(v),
                  },
                })
              }
            />
            {t('adminIntel.pipeline.requireAll', 'All required present')}
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-foreground/60">
              {t('adminIntel.pipeline.onFail', 'On fail')}
            </span>
            <Select
              value={config.autoAdvance?.onFail ?? 'review'}
              onValueChange={(v) =>
                setConfig({
                  autoAdvance: {
                    ...config.autoAdvance,
                    onFail: v as 'review' | 'reject',
                  },
                })
              }
            >
              <SelectTrigger className="w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review">review</SelectItem>
                <SelectItem value="reject">reject</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      )}
    </Card>
  );
}

/** Expanded-row preview: the pipeline's ordered stages as a flow of chips. */
function ExpandedPipeline({ pipelineKey }: { pipelineKey: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = usePipeline(pipelineKey);
  if (isLoading || !data) {
    return (
      <p className="text-xs text-foreground/50">
        {t('common.loading', 'Loading…')}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {data.stages.map((s, i) => (
        <span key={`${s.type}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-foreground/30">→</span>}
          <span className="rounded-md border border-border px-2 py-1 text-xs">
            <span className="font-medium text-foreground">{s.name}</span>
            <span className="ml-1 text-foreground/40">{s.type}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
