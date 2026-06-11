import type {
  AdminPipelineSummary,
  PipelineStageInput,
  StageConfig,
  StageType,
} from '@org/api-client';
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type DataTableColumn,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  CopyIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  IconButton,
  TrashIcon,
} from './icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import {
  usePipeline,
  usePipelines,
  usePurgePipeline,
  useSavePipeline,
  useSchemas,
  useSetPipelineActive,
} from './queries';

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

interface EditorState {
  key: string;
  name: string;
  stages: PipelineStageInput[];
}

const defaultStage = (type: StageType): PipelineStageInput => ({
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

/**
 * Admin pipeline editor (docs/07 P4.2): compose an ordered, typed stage list
 * (e.g. classify → review → extract → review → export), with per-stage config —
 * auto-advance thresholds, manual-review gates, classifier candidate allowlist,
 * and the extraction engine/schema pin. Saving mints a new immutable version.
 */
export function PipelineManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [showDisabled, setShowDisabled] = useState(false);
  const { data: pipelines, isLoading } = usePipelines(showDisabled);
  const { data: schemas } = useSchemas();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<EditorState | null>(null);
  const [cloning, setCloning] = useState(false);
  const { data: loaded } = usePipeline(editingKey);
  const save = useSavePipeline();
  const setActive = useSetPipelineActive();
  const purge = usePurgePipeline();

  useEffect(() => {
    if (!editingKey || !loaded) return;
    setDraft({
      key: cloning ? `${loaded.key}_copy` : loaded.key,
      name: cloning ? `${loaded.name} (copy)` : loaded.name,
      stages: loaded.stages.map((s) => ({ ...s, config: { ...s.config } })),
    });
    if (cloning) setCreating(true);
  }, [editingKey, loaded, cloning]);

  const close = () => {
    setDraft(null);
    setEditingKey(null);
    setCreating(false);
    setCloning(false);
  };

  const startEdit = (key: string) => {
    setCloning(false);
    setCreating(false);
    setDraft(null);
    setEditingKey(key);
  };

  const startClone = (key: string) => {
    setCloning(true);
    setDraft(null);
    setEditingKey(key);
  };

  const startCreate = () => {
    setEditingKey(null);
    setCreating(true);
    setDraft({
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
  };

  const setStage = (i: number, patch: Partial<PipelineStageInput>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      stages: draft.stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    });
  };

  const setConfig = (i: number, patch: Partial<StageConfig>) => {
    if (!draft) return;
    setStage(i, { config: { ...draft.stages[i].config, ...patch } });
  };

  const moveStage = (i: number, dir: -1 | 1) => {
    if (!draft) return;
    const j = i + dir;
    if (j < 0 || j >= draft.stages.length) return;
    const stages = [...draft.stages];
    [stages[i], stages[j]] = [stages[j], stages[i]];
    setDraft({ ...draft, stages });
  };

  const onSave = () => {
    if (!draft || !draft.key.trim() || !draft.name.trim()) return;
    save.mutate(
      {
        exists: !creating,
        payload: {
          key: draft.key.trim(),
          name: draft.name.trim(),
          stages: draft.stages.map((s) => ({
            type: s.type,
            name: s.name.trim() || s.type,
            config: s.config ?? {},
          })),
        },
      },
      { onSuccess: close },
    );
  };

  if (draft) {
    const valid = Boolean(
      draft.key.trim() && draft.name.trim() && draft.stages.length,
    );
    const types = draft.stages.map((s) => s.type);
    const warnings: string[] = [];
    if (!types.includes('extract'))
      warnings.push(
        t(
          'adminIntel.pipeline.warnNoExtract',
          'No extract stage — nothing will be pulled out of the document.',
        ),
      );
    if (!types.includes('classify') && !draft.stages.some((s) => s.config.schemaKey))
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
      draft.stages.some(
        (s) => s.type === 'filter' && !(s.config.allowedTypes ?? []).length,
      )
    )
      warnings.push(
        t(
          'adminIntel.pipeline.warnEmptyFilter',
          'A filter stage has no types selected — it keeps everything (archives nothing).',
        ),
      );
    if (types.indexOf('filter') >= 0 && types.indexOf('filter') < types.indexOf('classify'))
      warnings.push(
        t(
          'adminIntel.pipeline.warnFilterBeforeClassify',
          'Filter runs before classify — it has no type to check yet. Put classify first.',
        ),
      );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">
            {creating
              ? t('adminIntel.pipeline.createTitle', 'New pipeline')
              : t('adminIntel.pipeline.editTitle', 'Edit pipeline')}
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
                : t('adminIntel.pipeline.saveVersion', 'Save (new version)')}
            </Button>
          </div>
        </div>
        {!valid && (
          <p className="text-xs text-warning-foreground">
            {t(
              'adminIntel.pipeline.invalid',
              'A key, a name, and at least one stage are required.',
            )}
          </p>
        )}
        {warnings.length > 0 && (
          <ul className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground space-y-1">
            {warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-foreground/60">
              {t('adminIntel.pipeline.key', 'Key (stable id)')}
            </span>
            <Input
              value={draft.key}
              disabled={!creating}
              placeholder="contracts_review"
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            />
          </label>
          <label className="text-sm">
            <span className="text-foreground/60">
              {t('adminIntel.pipeline.name', 'Display name')}
            </span>
            <Input
              value={draft.name}
              placeholder="Contracts (with double review)"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <h4 className="font-medium text-foreground">
            {t('adminIntel.pipeline.stages', 'Stages (run top to bottom)')}
          </h4>
        </div>

        <div className="space-y-2">
          {draft.stages.map((s, i) => (
            <Card key={i} className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground/40 w-5">{i + 1}</span>
                <Select
                  value={s.type}
                  onValueChange={(v) =>
                    setStage(i, {
                      ...defaultStage(v as StageType),
                      name: s.name,
                    })
                  }
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
                <Input
                  className="flex-1"
                  value={s.name}
                  onChange={(e) => setStage(i, { name: e.target.value })}
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => moveStage(i, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => moveStage(i, 1)}>
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        stages: draft.stages.filter((_, idx) => idx !== i),
                      })
                    }
                  >
                    ✕
                  </Button>
                </div>
              </div>
              <p className="text-xs text-foreground/50">{STAGE_HELP[s.type]}</p>

              {s.type === 'classify' && (
                <div className="text-sm">
                  <span className="text-foreground/60">
                    {t(
                      'adminIntel.pipeline.candidateKeys',
                      'Restrict to these types (none = all):',
                    )}
                  </span>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {(schemas ?? []).map((sc) => {
                      const checked = (s.config.candidateKeys ?? []).includes(
                        sc.key,
                      );
                      return (
                        <label key={sc.key} className="flex items-center gap-1.5">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const set = new Set(s.config.candidateKeys ?? []);
                              if (v) set.add(sc.key);
                              else set.delete(sc.key);
                              setConfig(i, {
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

              {s.type === 'filter' && (
                <div className="space-y-2 text-sm">
                  <span className="text-foreground/60">
                    {t(
                      'adminIntel.pipeline.allowedTypes',
                      'Keep only these types (archive the rest):',
                    )}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {(schemas ?? []).map((sc) => {
                      const checked = (s.config.allowedTypes ?? []).includes(
                        sc.key,
                      );
                      return (
                        <label key={sc.key} className="flex items-center gap-1.5">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const set = new Set(s.config.allowedTypes ?? []);
                              if (v) set.add(sc.key);
                              else set.delete(sc.key);
                              setConfig(i, { allowedTypes: [...set] });
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
                        value={s.config.minConfidence ?? 0}
                        onChange={(e) =>
                          setConfig(i, {
                            minConfidence: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-foreground/60">
                        {t('adminIntel.pipeline.onUnmatched', 'Out-of-scope →')}
                      </span>
                      <Select
                        value={s.config.onUnmatched ?? 'archive'}
                        onValueChange={(v) =>
                          setConfig(i, {
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

              {s.type === 'extract' && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <span className="text-foreground/60">
                      {t('adminIntel.pipeline.engineMode', 'Engine')}
                    </span>
                    <Select
                      value={s.config.engineMode ?? 'auto'}
                      onValueChange={(v) =>
                        setConfig(i, {
                          engineMode: v as StageConfig['engineMode'],
                        })
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
                      value={s.config.schemaKey ?? CLASSIFIED}
                      onValueChange={(v) =>
                        setConfig(i, {
                          schemaKey: v === CLASSIFIED ? undefined : v,
                        })
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

              {s.type === 'validate' && (
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
                      value={s.config.autoAdvance?.minOverall ?? 0.9}
                      onChange={(e) =>
                        setConfig(i, {
                          autoAdvance: {
                            ...s.config.autoAdvance,
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
                      value={s.config.autoAdvance?.minField ?? 0.85}
                      onChange={(e) =>
                        setConfig(i, {
                          autoAdvance: {
                            ...s.config.autoAdvance,
                            minField: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Checkbox
                      checked={Boolean(
                        s.config.autoAdvance?.requireAllRequired,
                      )}
                      onCheckedChange={(v) =>
                        setConfig(i, {
                          autoAdvance: {
                            ...s.config.autoAdvance,
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
                      value={s.config.autoAdvance?.onFail ?? 'review'}
                      onValueChange={(v) =>
                        setConfig(i, {
                          autoAdvance: {
                            ...s.config.autoAdvance,
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
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t('adminIntel.pipeline.addStage', '+ Add stage…')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STAGE_TYPES.map((ty) => (
              <DropdownMenuItem
                key={ty}
                onSelect={() =>
                  setDraft({
                    ...draft,
                    stages: [...draft.stages, defaultStage(ty as StageType)],
                  })
                }
              >
                {ty}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

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
      cell: (p) => <span className="tabular-nums text-foreground/60">v{p.version}</span>,
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
      cell: (p) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton title={t('common.edit', 'Edit')} onClick={() => startEdit(p.key)}>
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
              onClick={() => setActive.mutate({ key: p.key, active: true })}
            >
              <EyeOffIcon />
            </IconButton>
          ) : (
            <IconButton
              title={t('adminIntel.pipeline.disable', 'Disable')}
              disabled={setActive.isPending}
              onClick={() => setActive.mutate({ key: p.key, active: false })}
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
        <p className="text-foreground/60 text-sm">{t('common.loading', 'Loading…')}</p>
      ) : (
        <DataTable
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

/** Expanded-row preview: the pipeline's ordered stages as a flow of chips. */
function ExpandedPipeline({ pipelineKey }: { pipelineKey: string }) {
  const { t } = useTranslation();
  const { data, isLoading } = usePipeline(pipelineKey);
  if (isLoading || !data) {
    return (
      <p className="text-xs text-foreground/50">{t('common.loading', 'Loading…')}</p>
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
