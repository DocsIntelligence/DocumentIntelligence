import { Button, Card } from '@org/ui';
import { cn } from '@org/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import type { MasterPlanResult, MasterRecordPlan } from '@org/api-client';
import { useMasterAssistantService } from '../../documents/services-context';

interface AiMasterSetupProps {
  /** Which master to target: 'lookup' | 'document-type' | 'legal-reference'. */
  masterKey: string;
  /** Panel heading (defaults to "Set up with AI"). */
  heading?: string;
  /** Placeholder shown in the prompt box (master-specific example). */
  placeholder?: string;
  /**
   * Optional scope passed to the planner, e.g. { groupKey, groupName } to
   * target one existing lookup group so the prompt only adds values to it.
   */
  context?: Record<string, string>;
  /** Called after a successful commit so the host page can refetch its list. */
  onCommitted?: () => void;
}

function extractMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data?.message;
  if (typeof data === 'string' && data.trim()) return data;
  if (Array.isArray(data) && typeof data[0] === 'string') return data[0];
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/**
 * AI-assisted master setup panel. A collapsible "Set up with AI" card: type a
 * prompt → preview proposed create/update records (per-row include toggle) →
 * apply. Generic over any master key; mounted on each config page. Nothing is
 * written until "Apply" — mirrors the statute-import preview→commit flow.
 */
export function AiMasterSetup({
  masterKey,
  heading = 'Set up with AI',
  placeholder,
  context,
  onCommitted,
}: AiMasterSetupProps) {
  const svc = useMasterAssistantService();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<MasterPlanResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // ref → pretty-JSON string while a record is being edited in the review step.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPlan(null);
    setSelected(new Set());
    setDrafts({});
    setError(null);
  };

  const onPlan = async () => {
    if (!prompt.trim()) return;
    setPlanning(true);
    setError(null);
    try {
      const result = await svc.plan(masterKey, prompt.trim(), context);
      setPlan(result);
      // Pre-select records that actually change something; leave duplicates
      // (no net change) unchecked so they aren't re-applied.
      setSelected(
        new Set(result.plans.filter((p) => !p.duplicate).map((p) => p.ref)),
      );
    } catch (e) {
      setPlan(null);
      setError(extractMessage(e, 'Could not generate a plan.'));
    } finally {
      setPlanning(false);
    }
  };

  const onApply = async () => {
    if (!plan || selected.size === 0) return;

    // Parse any edited records (only for selected refs); abort on invalid JSON
    // so the user can fix it rather than silently dropping their edit.
    const edits: Record<string, unknown> = {};
    for (const ref of selected) {
      const draft = drafts[ref];
      if (draft === undefined) continue;
      try {
        edits[ref] = JSON.parse(draft);
      } catch {
        setError(
          `One of the edited records isn't valid JSON. Fix it (look for the highlighted record) before applying.`,
        );
        return;
      }
    }

    setApplying(true);
    setError(null);
    try {
      const res = await svc.commit(
        plan.planId,
        Array.from(selected),
        Object.keys(edits).length ? edits : undefined,
      );
      const parts: string[] = [];
      if (res.created) parts.push(`${res.created} created`);
      if (res.updated) parts.push(`${res.updated} updated`);
      if (res.failed) parts.push(`${res.failed} failed`);
      if (res.failed > 0) {
        const firstErr = res.results.find((r) => !r.ok)?.error;
        toast.warning(
          `Applied with issues: ${parts.join(' · ')}${firstErr ? ` — ${firstErr}` : ''}`,
        );
      } else {
        toast.success(`Applied: ${parts.join(' · ') || 'no changes'}`);
      }
      reset();
      setPrompt('');
      onCommitted?.();
    } catch (e) {
      setError(extractMessage(e, 'Could not apply the plan.'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="rounded-xl border-primary/30 bg-primary/5 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <span className="text-base">✨</span>
        <span className="font-medium text-foreground">{heading}</span>
        <span className="ml-auto text-xs text-foreground/50">
          {open ? 'Hide' : 'Describe what you need →'}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              placeholder ??
              'Describe the records to create or update in plain English…'
            }
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onPlan} disabled={planning || !prompt.trim()}>
              {planning ? 'Generating…' : 'Generate plan'}
            </Button>
            {plan && (
              <Button size="sm" variant="ghost" onClick={reset} disabled={applying}>
                Clear
              </Button>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
            >
              {error}
            </div>
          )}

          {plan && plan.plans.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-foreground/55">
                {plan.plans.length} record(s) proposed
                {plan.plans.some((p) => p.duplicate) &&
                  ` · ${plan.plans.filter((p) => p.duplicate).length} already exist (unchecked)`}{' '}
                · expand to review the fields, edit if needed, then apply
                (nothing is saved until you apply).
              </p>
              <ul className="divide-y divide-border rounded-md border border-border bg-background">
                {plan.plans.map((p) => (
                  <PlanRow
                    key={p.ref}
                    plan={p}
                    checked={selected.has(p.ref)}
                    draft={drafts[p.ref]}
                    onToggle={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.ref)) next.delete(p.ref);
                        else next.add(p.ref);
                        return next;
                      })
                    }
                    onStartEdit={() =>
                      setDrafts((prev) => ({
                        ...prev,
                        [p.ref]: JSON.stringify(p.record, null, 2),
                      }))
                    }
                    onChangeDraft={(text) =>
                      setDrafts((prev) => ({ ...prev, [p.ref]: text }))
                    }
                    onCancelEdit={() =>
                      setDrafts((prev) => {
                        const next = { ...prev };
                        delete next[p.ref];
                        return next;
                      })
                    }
                  />
                ))}
              </ul>
              <Button
                size="sm"
                onClick={onApply}
                disabled={applying || selected.size === 0}
              >
                {applying
                  ? 'Applying…'
                  : `Apply ${selected.size} record${selected.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PlanRow({
  plan,
  checked,
  draft,
  onToggle,
  onStartEdit,
  onChangeDraft,
  onCancelEdit,
}: {
  plan: MasterRecordPlan;
  checked: boolean;
  /** Pretty-JSON edit buffer, or undefined when not being edited. */
  draft: string | undefined;
  onToggle: () => void;
  onStartEdit: () => void;
  onChangeDraft: (text: string) => void;
  onCancelEdit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const editing = draft !== undefined;
  const edited = editing; // a present draft means the user opened the editor
  const draftInvalid = (() => {
    if (draft === undefined) return false;
    try {
      JSON.parse(draft);
      return false;
    } catch {
      return true;
    }
  })();

  return (
    <li className="px-3 py-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 size-4 flex-none accent-primary"
        />
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                plan.action === 'create'
                  ? 'bg-success/15 text-success'
                  : 'bg-info/15 text-info',
              )}
            >
              {plan.action}
            </span>
            <span className="truncate text-sm font-medium text-foreground">
              {plan.label}
            </span>
            {plan.duplicate && (
              <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-foreground/55">
                no change
              </span>
            )}
            {edited && (
              <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                edited
              </span>
            )}
            <span className="ml-auto flex-none text-xs text-foreground/40">
              {expanded ? '▲' : '▼'}
            </span>
          </div>
          {plan.note && (
            <p className="mt-0.5 text-xs text-foreground/50">{plan.note}</p>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 ml-7 space-y-2">
          {editing ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => onChangeDraft(e.target.value)}
                spellCheck={false}
                rows={Math.min(20, (draft.match(/\n/g)?.length ?? 0) + 2)}
                className={cn(
                  'w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none',
                  draftInvalid ? 'border-error/60' : 'border-border focus:border-primary/50',
                )}
              />
              <div className="flex items-center gap-2">
                {draftInvalid && (
                  <span className="text-xs text-error">Invalid JSON</span>
                )}
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="ml-auto text-xs text-foreground/60 hover:text-foreground"
                >
                  Discard edit
                </button>
              </div>
            </>
          ) : (
            <>
              <RecordView record={plan.record} />
              <button
                type="button"
                onClick={onStartEdit}
                className="text-xs text-primary hover:underline"
              >
                Edit fields (JSON)
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Readable, type-agnostic view of a proposed record: scalars as label/value
 * lines, arrays of objects as a compact list (covers lookup values, document
 * type fields, citation fields without bespoke renderers per master).
 */
function RecordView({ record }: { record: unknown }) {
  if (record === null || typeof record !== 'object') {
    return <p className="text-xs text-foreground/70">{String(record)}</p>;
  }
  const entries = Object.entries(record as Record<string, unknown>);
  return (
    <dl className="space-y-1.5 rounded-md bg-secondary/30 p-2.5 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2">
          <dt className="w-32 flex-none font-medium text-foreground/55">
            {key}
          </dt>
          <dd className="min-w-0 flex-1 text-foreground/85">
            <FieldValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FieldValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-foreground/40">—</span>;
    return (
      <ul className="space-y-0.5">
        {value.map((item, i) => (
          <li key={i} className="truncate">
            {item !== null && typeof item === 'object'
              ? Object.entries(item as Record<string, unknown>)
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(' · ')
              : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (value === null || value === undefined || value === '') {
    return <span className="text-foreground/40">—</span>;
  }
  if (typeof value === 'object') {
    return <span className="font-mono">{JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}
