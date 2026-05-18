import type {
  FieldMetadata,
  FormMetadata,
  ShowIfClause,
} from '@org/document-schema';
import { Button } from '@org/ui';
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type ChangeEvent,
} from 'react';
import { labelFor } from './sectionLabels';

interface Props {
  data: Record<string, unknown>;
  formMetadata: FormMetadata;
  sectionOrder: string[];
  onChange: (data: Record<string, unknown>) => void;
  onAiAssist?: (promptKey: string, fieldPath: string) => void;
  aiBusyField?: string | null;
}

export interface BuilderFormHandle {
  scrollToSection: (sectionKey: string) => void;
}

/**
 * Middle pane. Renders a flat form derived from form-metadata. No RHF
 * required at this size — controlled inputs with debounced parent
 * updates. Adding RHF + zodResolver is a future iteration; the current
 * shape keeps the autosave loop very simple.
 *
 * The form is organised by section anchor (`data-section`) so the
 * sections tree can scroll to each section.
 */
export const BuilderForm = forwardRef<BuilderFormHandle, Props>(
  function BuilderForm(
    { data, formMetadata, sectionOrder, onChange, onAiAssist, aiBusyField },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => ({
      scrollToSection(sectionKey: string) {
        const root = scrollRef.current;
        if (!root) return;
        const el = root.querySelector<HTMLElement>(
          `[data-section="${cssEscape(sectionKey)}"]`,
        );
        if (el)
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }));

    const fieldsBySection = useMemo(() => {
      const map = new Map<string, [string, FieldMetadata][]>();
      for (const sk of sectionOrder) map.set(sk, []);
      for (const [path, meta] of Object.entries(formMetadata)) {
        const section = sectionOrder.find(
          (s) => path === s || path.startsWith(`${s}.`),
        );
        const key = section ?? path;
        const bucket = map.get(key) ?? [];
        bucket.push([path, meta]);
        map.set(key, bucket);
      }
      return map;
    }, [formMetadata, sectionOrder]);

    function setAt(path: string, value: unknown) {
      const next = deepSet(structuredClone(data), path, value);
      onChange(next);
    }

    return (
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-6 py-5 space-y-8"
      >
        {sectionOrder.map((sectionKey) => {
          const fields = fieldsBySection.get(sectionKey) ?? [];
          if (fields.length === 0) return null;
          return (
            <section
              key={sectionKey}
              data-section={sectionKey}
              className="space-y-3 scroll-mt-4"
            >
              <h3 className="text-base font-semibold text-foreground border-b pb-2">
                {labelFor(sectionKey)}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {fields.map(([path, meta]) => {
                  if (
                    meta.showIf &&
                    !evalShowIf(meta.showIf, data)
                  ) {
                    return null;
                  }
                  return (
                    <Field
                      key={path}
                      path={path}
                      meta={meta}
                      value={deepGet(data, path)}
                      onChange={(v) => setAt(path, v)}
                      onAiAssist={onAiAssist}
                      aiBusy={aiBusyField === path}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  },
);

// ─── Field ──────────────────────────────────────────────────────────────

interface FieldProps {
  path: string;
  meta: FieldMetadata;
  value: unknown;
  onChange: (value: unknown) => void;
  onAiAssist?: (promptKey: string, fieldPath: string) => void;
  aiBusy?: boolean;
}

function Field({ path, meta, value, onChange, onAiAssist, aiBusy }: FieldProps) {
  const widget = meta.widget ?? 'text';
  const id = `f-${path.replace(/\./g, '-')}`;
  const isFullWidth =
    widget === 'textarea' || widget === 'address' || widget === 'inventory';

  return (
    <label
      htmlFor={id}
      className={[
        'flex flex-col gap-1 text-sm',
        isFullWidth ? 'sm:col-span-2' : '',
      ].join(' ')}
    >
      <span className="flex items-center justify-between">
        <span className="font-medium text-foreground/80">{meta.label}</span>
        {meta.aiPromptKey && onAiAssist && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={aiBusy}
            onClick={() => {
              if (meta.aiPromptKey) onAiAssist(meta.aiPromptKey, path);
            }}
            className="h-6 px-2 text-[10px] uppercase tracking-wide"
          >
            {aiBusy ? '…' : 'AI'}
          </Button>
        )}
      </span>
      {renderInput(id, widget, value, onChange, meta)}
      {meta.helperText && (
        <span className="text-xs text-foreground/50">{meta.helperText}</span>
      )}
    </label>
  );
}

function renderInput(
  id: string,
  widget: string,
  value: unknown,
  onChange: (v: unknown) => void,
  meta: FieldMetadata,
) {
  const baseCls =
    'rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

  if (widget === 'textarea' || widget === 'address') {
    return (
      <textarea
        id={id}
        className={baseCls}
        rows={3}
        placeholder={meta.placeholder}
        value={asString(value)}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
      />
    );
  }
  if (widget === 'number' || widget === 'currency') {
    return (
      <input
        id={id}
        type="number"
        className={baseCls}
        placeholder={meta.placeholder}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? undefined : Number(v));
        }}
      />
    );
  }
  if (widget === 'date') {
    return (
      <input
        id={id}
        type="date"
        className={baseCls}
        value={asString(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (typeof value === 'boolean' || widget === 'boolean') {
    return (
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    );
  }
  if (widget === 'select') {
    // Default: show a text input. A future iteration can render proper
    // <Select> options once form-metadata carries enums.
    return (
      <input
        id={id}
        type="text"
        className={baseCls}
        placeholder={meta.placeholder}
        value={asString(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      id={id}
      type="text"
      className={baseCls}
      placeholder={meta.placeholder}
      value={asString(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function deepGet(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, k) => {
      if (acc && typeof acc === 'object' && k in acc) {
        return (acc as Record<string, unknown>)[k];
      }
      return undefined;
    }, obj);
}

function deepSet(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (
      cur[k] === undefined ||
      cur[k] === null ||
      typeof cur[k] !== 'object'
    ) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return obj;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

function evalShowIf(
  clause: ShowIfClause,
  data: Record<string, unknown>,
): boolean {
  if ('allOf' in clause) return clause.allOf.every((c) => evalShowIf(c, data));
  if ('anyOf' in clause) return clause.anyOf.some((c) => evalShowIf(c, data));
  const v = deepGet(data, clause.field);
  if ('equals' in clause) return v === clause.equals;
  if ('in' in clause) return clause.in.includes(v);
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return false;
  if ('gt' in clause && clause.gt != null && !(n > clause.gt)) return false;
  if ('lt' in clause && clause.lt != null && !(n < clause.lt)) return false;
  if ('gte' in clause && clause.gte != null && !(n >= clause.gte)) return false;
  if ('lte' in clause && clause.lte != null && !(n <= clause.lte)) return false;
  return true;
}

function cssEscape(s: string): string {
  // Simple CSS attribute escape — enough for our dotted section keys.
  return s.replace(/["\\]/g, '\\$&');
}
