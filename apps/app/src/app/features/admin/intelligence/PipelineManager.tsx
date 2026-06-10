import type {
  PipelineStageInput,
  StageConfig,
  StageType,
} from '@org/api-client';
import { Badge, Button, Card, Checkbox, Input } from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import {
  useDeletePipeline,
  usePipeline,
  usePipelines,
  useSavePipeline,
  useSchemas,
} from './queries';

const STAGE_TYPES: StageType[] = [
  'ingest',
  'classify',
  'extract',
  'validate',
  'review',
  'export',
];

const STAGE_HELP: Record<StageType, string> = {
  ingest: 'Parse the file to text (fast path for extraction).',
  classify: 'Identify the document type.',
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
  const { data: pipelines, isLoading } = usePipelines();
  const { data: schemas } = useSchemas();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<EditorState | null>(null);
  const { data: loaded } = usePipeline(editingKey);
  const save = useSavePipeline();
  const del = useDeletePipeline();

  if (editingKey && loaded && draft?.key !== loaded.key) {
    setDraft({
      key: loaded.key,
      name: loaded.name,
      stages: loaded.stages.map((s) => ({ ...s, config: { ...s.config } })),
    });
  }

  const close = () => {
    setDraft(null);
    setEditingKey(null);
    setCreating(false);
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
            <Button size="sm" onClick={onSave} disabled={save.isPending}>
              {save.isPending
                ? t('common.saving', 'Saving…')
                : t('adminIntel.pipeline.saveVersion', 'Save (new version)')}
            </Button>
          </div>
        </div>

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
                <select
                  className="border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                  value={s.type}
                  onChange={(e) =>
                    setStage(i, {
                      ...defaultStage(e.target.value as StageType),
                      name: s.name,
                    })
                  }
                >
                  {STAGE_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {ty}
                    </option>
                  ))}
                </select>
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

              {s.type === 'extract' && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <span className="text-foreground/60">
                      {t('adminIntel.pipeline.engineMode', 'Engine')}
                    </span>
                    <select
                      className="border border-border rounded-md px-2 py-1.5 bg-background"
                      value={s.config.engineMode ?? 'auto'}
                      onChange={(e) =>
                        setConfig(i, {
                          engineMode: e.target
                            .value as StageConfig['engineMode'],
                        })
                      }
                    >
                      {['auto', 'native', 'vlm', 'agentic'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-foreground/60">
                      {t('adminIntel.pipeline.pinSchema', 'Force type')}
                    </span>
                    <select
                      className="border border-border rounded-md px-2 py-1.5 bg-background"
                      value={s.config.schemaKey ?? ''}
                      onChange={(e) =>
                        setConfig(i, { schemaKey: e.target.value || undefined })
                      }
                    >
                      <option value="">
                        {t('adminIntel.pipeline.useClassified', '(use classified)')}
                      </option>
                      {(schemas ?? []).map((sc) => (
                        <option key={sc.key} value={sc.key}>
                          {sc.key}
                        </option>
                      ))}
                    </select>
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
                    <select
                      className="border border-border rounded-md px-2 py-1.5 bg-background"
                      value={s.config.autoAdvance?.onFail ?? 'review'}
                      onChange={(e) =>
                        setConfig(i, {
                          autoAdvance: {
                            ...s.config.autoAdvance,
                            onFail: e.target.value as 'review' | 'reject',
                          },
                        })
                      }
                    >
                      <option value="review">review</option>
                      <option value="reject">reject</option>
                    </select>
                  </label>
                </div>
              )}
            </Card>
          ))}
        </div>

        <select
          className="border border-border rounded-md px-2 py-1.5 text-sm bg-background"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            setDraft({
              ...draft,
              stages: [...draft.stages, defaultStage(e.target.value as StageType)],
            });
          }}
        >
          <option value="">{t('adminIntel.pipeline.addStage', '+ Add stage…')}</option>
          {STAGE_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {ty}
            </option>
          ))}
        </select>
      </div>
    );
  }

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
        <div className="space-y-2">
          {(pipelines ?? []).map((p) => (
            <Card key={p.key} className="p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{p.name}</span>
                  <Badge variant="secondary">v{p.version}</Badge>
                </div>
                <span className="text-xs text-foreground/50">
                  {p.key} · {p.stageCount}{' '}
                  {t('adminIntel.pipeline.stagesLower', 'stages')}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCreating(false);
                    setDraft(null);
                    setEditingKey(p.key);
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
                      title: t(
                        'adminIntel.pipeline.deleteTitle',
                        'Deactivate pipeline?',
                      ),
                      description: t(
                        'adminIntel.pipeline.deleteDesc',
                        'In-flight runs are unaffected; new runs cannot use it.',
                      ),
                      confirmLabel: t('common.delete', 'Delete'),
                      variant: 'destructive',
                    });
                    if (ok) del.mutate(p.key);
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
