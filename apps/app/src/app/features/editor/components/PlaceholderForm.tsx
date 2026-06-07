import { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';

import type { PlaceholderDef } from '../templates/types';

export type PlaceholderFormHandle = {
  focusField: (key: string) => void;
};

export type PlaceholderFormProps = {
  fields: PlaceholderDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  /** Optional list of placeholder keys that exist in the doc but have no metadata (custom tokens). */
  unknownKeys?: string[];
  className?: string;
};

export const PlaceholderForm = forwardRef<
  PlaceholderFormHandle,
  PlaceholderFormProps
>(({ fields, values, onChange, unknownKeys = [], className }, ref) => {
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useImperativeHandle(
    ref,
    () => ({
      focusField: (key) => {
        const el = refs.current[key];
        if (el) {
          el.focus();
          if (typeof (el as HTMLInputElement).select === 'function') {
            (el as HTMLInputElement).select();
          }
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
    }),
    [],
  );

  if (fields.length === 0 && unknownKeys.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center px-4 py-10 text-center',
          className,
        )}
      >
        <div className="mb-3 text-3xl opacity-40">📝</div>
        <p className="text-sm font-medium text-foreground/70">
          No placeholders in this document
        </p>
        <p className="mt-1 text-xs text-foreground/50">
          Add <code className="rounded bg-secondary/40 px-1 py-0.5">{'{{name}}'}</code>{' '}
          tokens in the editor and they will appear here automatically.
        </p>
      </div>
    );
  }

  const allKeys = new Set(fields.map((f) => f.key));
  const extra = unknownKeys.filter((k) => !allKeys.has(k));

  return (
    <div className={cn('flex flex-col gap-3 px-4 py-4', className)}>
      {fields.map((field) => (
        <Field
          key={field.key}
          field={field}
          value={values[field.key] ?? ''}
          onChange={(v) => onChange(field.key, v)}
          inputRef={(el) => {
            refs.current[field.key] = el;
          }}
        />
      ))}

      {extra.length > 0 && (
        <>
          <div className="mt-2 border-t border-border pt-3 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
            Custom Fields
          </div>
          {extra.map((key) => (
            <Field
              key={key}
              field={{ key, label: humanize(key), type: 'text' }}
              value={values[key] ?? ''}
              onChange={(v) => onChange(key, v)}
              inputRef={(el) => {
                refs.current[key] = el;
              }}
            />
          ))}
        </>
      )}
    </div>
  );
});

PlaceholderForm.displayName = 'PlaceholderForm';

type FieldProps = {
  field: PlaceholderDef;
  value: string;
  onChange: (v: string) => void;
  inputRef: (el: HTMLElement | null) => void;
};

function Field({ field, value, onChange, inputRef }: FieldProps) {
  const id = `pl-${field.key}`;
  const filled = !!value.trim();

  return (
    <div className={cn('flex flex-col gap-1.5', field.wide && 'col-span-2')}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-xs">
          {field.label}
        </Label>
        <span
          className={cn(
            'inline-block size-1.5 rounded-full transition-colors',
            filled ? 'bg-emerald-500' : 'bg-amber-400',
          )}
          aria-label={filled ? 'filled' : 'empty'}
        />
      </div>

      {field.type === 'textarea' ? (
        <Textarea
          id={id}
          ref={inputRef as React.Ref<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          rows={3}
          className="resize-y text-sm"
        />
      ) : field.type === 'select' && field.options ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger
            id={id}
            ref={inputRef as React.Ref<HTMLButtonElement>}
            className="text-sm"
          >
            <SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          ref={inputRef as React.Ref<HTMLInputElement>}
          type={
            field.type === 'date'
              ? 'date'
              : field.type === 'number'
              ? 'number'
              : field.type === 'email'
              ? 'email'
              : 'text'
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
        />
      )}

      {field.hint && (
        <p className="text-[11px] text-foreground/55">{field.hint}</p>
      )}
    </div>
  );
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
