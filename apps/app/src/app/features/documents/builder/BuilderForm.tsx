import type {
  FieldMetadata,
  FieldOption,
  FormMetadata,
  ShowIfClause,
} from '@org/document-schema';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
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
  /** Resolved `lookup` options keyed by `lookupKey` (from public lookups). */
  lookupOptions?: Record<string, FieldOption[]>;
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
    {
      data,
      formMetadata,
      sectionOrder,
      lookupOptions,
      onChange,
      onAiAssist,
      aiBusyField,
    },
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
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                  if (meta.showIf && !evalShowIf(meta.showIf, data)) {
                    return null;
                  }
                  // Repeating object-array (e.g. witnesses): its own editor
                  // with add/remove rows, spanning the full grid width.
                  if (meta.widget === 'group') {
                    return (
                      <GroupEditor
                        key={path}
                        path={path}
                        meta={meta}
                        data={data}
                        setAt={setAt}
                      />
                    );
                  }
                  // Resolve `lookup` fields against the fetched options, so a
                  // DB-backed list (e.g. states) renders as a real dropdown.
                  const resolved =
                    meta.widget === 'lookup' &&
                    meta.lookupKey &&
                    lookupOptions?.[meta.lookupKey]
                      ? {
                          ...meta,
                          options: meta.options ?? lookupOptions[meta.lookupKey],
                        }
                      : meta;
                  return (
                    <Field
                      key={path}
                      path={path}
                      meta={resolved}
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

function Field({
  path,
  meta,
  value,
  onChange,
  onAiAssist,
  aiBusy,
}: FieldProps) {
  const widget = meta.widget ?? 'text';
  const id = `f-${path.replace(/\./g, '-')}`;
  const isFullWidth =
    widget === 'textarea' ||
    widget === 'address' ||
    widget === 'inventory' ||
    widget === 'list';

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

const BASE_INPUT_CLS =
  'rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50';

/**
 * Input affordances for India-specific text widgets. Light-touch: keyboard
 * hint + length cap + (PAN) uppercase. Authoritative validation stays in the
 * Zod schema, so these never block typing.
 */
const MASKED_INPUTS: Record<
  string,
  {
    inputMode?: 'tel' | 'numeric' | 'text';
    maxLength?: number;
    upper?: boolean;
    placeholder?: string;
  }
> = {
  phone: { inputMode: 'tel', maxLength: 15, placeholder: '+91 98765 43210' },
  pincode: { inputMode: 'numeric', maxLength: 6, placeholder: '560001' },
  aadhaar: { inputMode: 'numeric', maxLength: 14, placeholder: 'XXXX XXXX 1234' },
  pan: { inputMode: 'text', maxLength: 10, upper: true, placeholder: 'ABCDE1234F' },
};

function renderInput(
  id: string,
  widget: string,
  value: unknown,
  onChange: (v: unknown) => void,
  meta: FieldMetadata,
) {
  // Repeated, editable list of strings (e.g. RTI questions, affidavit
  // statements, facts, inventory). Add/edit/remove rows; stored as string[].
  if (widget === 'list') {
    return (
      <ListEditor id={id} value={value} meta={meta} onChange={onChange} />
    );
  }
  // Real dropdown when the field carries enum options; `lookup` reuses this and
  // falls back to a text input when no static options are supplied (dynamic
  // DB-backed lookups are a separate, future data source).
  if (widget === 'select' || widget === 'lookup') {
    if (meta.options && meta.options.length > 0) {
      return (
        <Select
          value={asString(value) || undefined}
          onValueChange={(v) => onChange(v || undefined)}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={meta.placeholder ?? 'Select…'} />
          </SelectTrigger>
          <SelectContent>
            {meta.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
  }
  if (widget === 'textarea' || widget === 'address') {
    return (
      <textarea
        id={id}
        className={BASE_INPUT_CLS}
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
        className={BASE_INPUT_CLS}
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
        className={BASE_INPUT_CLS}
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
  // Specialised text widgets: better mobile keyboards + length caps + PAN
  // auto-uppercase. Validation still lives in the Zod schema (gate on export).
  const masked = MASKED_INPUTS[widget];
  if (masked) {
    return (
      <input
        id={id}
        type="text"
        className={BASE_INPUT_CLS}
        inputMode={masked.inputMode}
        maxLength={masked.maxLength}
        autoCapitalize={masked.upper ? 'characters' : undefined}
        placeholder={meta.placeholder ?? masked.placeholder}
        value={asString(value)}
        onChange={(e) =>
          onChange(masked.upper ? e.target.value.toUpperCase() : e.target.value)
        }
      />
    );
  }
  // Plain text + any select/lookup without options.
  return (
    <input
      id={id}
      type="text"
      className={BASE_INPUT_CLS}
      placeholder={meta.placeholder}
      value={asString(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ─── List editor (string[] fields) ───────────────────────────────────────

function ListEditor({
  id,
  value,
  meta,
  onChange,
}: {
  id: string;
  value: unknown;
  meta: FieldMetadata;
  onChange: (v: unknown) => void;
}) {
  const items = Array.isArray(value)
    ? value.map((v) => (v == null ? '' : String(v)))
    : [];
  const commit = (next: string[]) => onChange(next);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            id={i === 0 ? id : undefined}
            className={`${BASE_INPUT_CLS} flex-1`}
            rows={2}
            placeholder={meta.placeholder}
            value={item}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
              const next = items.slice();
              next[i] = e.target.value;
              commit(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Remove item"
            className="mt-1 shrink-0"
            onClick={() => commit(items.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => commit([...items, ''])}
      >
        + Add
      </Button>
    </div>
  );
}

// ─── Group editor (object-array fields, e.g. witnesses) ───────────────────

function GroupEditor({
  path,
  meta,
  data,
  setAt,
}: {
  path: string;
  meta: FieldMetadata;
  data: Record<string, unknown>;
  setAt: (path: string, value: unknown) => void;
}) {
  const raw = deepGet(data, path);
  const items = Array.isArray(raw) ? raw : [];
  const itemFields = Object.entries(meta.itemFields ?? {});
  const maxItems = meta.maxItems ?? Number.POSITIVE_INFINITY;
  const itemLabel = meta.itemLabel ?? 'Item';
  const setItems = (next: unknown[]) => setAt(path, next);

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      <span className="font-medium text-foreground/80">{meta.label}</span>
      {meta.helperText && (
        <span className="-mt-2 text-xs text-foreground/50">
          {meta.helperText}
        </span>
      )}
      {items.map((_item, idx) => (
        <div
          key={idx}
          className="flex flex-col gap-3 rounded-md border border-border p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground/70">
              {itemLabel} {idx + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove ${itemLabel} ${idx + 1}`}
              onClick={() => setItems(items.filter((_, j) => j !== idx))}
            >
              ✕
            </Button>
          </div>
          {itemFields.map(([sub, subMeta]) => {
            const fullPath = `${path}.${idx}.${sub}`;
            return (
              <Field
                key={fullPath}
                path={fullPath}
                meta={subMeta}
                value={deepGet(data, fullPath)}
                onChange={(v) => setAt(fullPath, v)}
              />
            );
          })}
        </div>
      ))}
      {items.length < maxItems && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setItems([...items, {}])}
        >
          + Add {itemLabel}
        </Button>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function deepGet(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
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
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') {
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
