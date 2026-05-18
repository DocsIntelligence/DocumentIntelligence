import type { EditableWidget } from '@org/document-templates';
import { useEffect, useRef, useState } from 'react';

interface FieldMetadata {
  label?: string;
  helperText?: string;
  placeholder?: string;
}

interface Props {
  /** Iframe-viewport-relative coords of the clicked field. */
  fieldRect: { top: number; left: number; width: number; height: number };
  /** Parent-viewport-relative bounding rect of the <iframe> element. */
  iframeRect: { top: number; left: number };
  path: string;
  widget: EditableWidget;
  initialValue: unknown;
  metadata?: FieldMetadata;
  /** Closed without changes (Esc, outside click). */
  onCancel: () => void;
  /** Save and close (Enter for single-line, blur, or explicit Save). */
  onCommit: (newValue: unknown) => void;
}

/**
 * Small absolute-positioned editor anchored to the clicked placeholder in
 * the artboard iframe. Receives positions in two coordinate spaces:
 *   - fieldRect: the clicked element's rect, in iframe viewport
 *   - iframeRect: the iframe element's rect, in parent viewport
 * The popover is positioned at the sum, so it floats just under the
 * clicked placeholder.
 *
 * Coerces the user's input back to the widget's expected runtime type
 * (number for number/currency, string otherwise). Validation lives in
 * the Zod schema downstream — autosave PATCH will reject malformed values
 * if the user types nonsense, which surfaces as a toast.
 */
export function InlineEditPopover({
  fieldRect,
  iframeRect,
  path,
  widget,
  initialValue,
  metadata,
  onCancel,
  onCommit,
}: Props) {
  const [value, setValue] = useState<string>(
    initialValue === undefined || initialValue === null
      ? ''
      : String(initialValue),
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (inputRef.current && 'select' in inputRef.current) {
      (inputRef.current as HTMLInputElement).select?.();
    }
  }, []);

  // Close on outside click.
  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(ev.target as Node)) onCancel();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [onCancel]);

  function commit() {
    onCommit(coerce(value, widget));
  }

  const top = iframeRect.top + fieldRect.top + fieldRect.height + 4;
  const left = iframeRect.left + fieldRect.left;

  const inputType = inputTypeFor(widget);
  const isMulti = widget === 'textarea';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top,
        left,
        minWidth: 260,
        maxWidth: 360,
        zIndex: 1000,
        background: 'white',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8,
        boxShadow: '0 6px 28px rgba(0,0,0,0.18)',
        padding: 10,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
      }}
    >
      <div style={{ marginBottom: 6, fontWeight: 600, color: '#111' }}>
        {metadata?.label ?? path}
      </div>
      {isMulti ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder={metadata?.placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          style={inputStyle}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={inputType}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={metadata?.placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          style={inputStyle}
        />
      )}
      {metadata?.helperText && (
        <div style={{ marginTop: 6, color: '#6b7280', fontSize: 11 }}>
          {metadata.helperText}
        </div>
      )}
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 6,
        }}
      >
        <button onClick={onCancel} style={btnGhostStyle}>
          Cancel
        </button>
        <button onClick={commit} style={btnPrimaryStyle}>
          Save
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #d4d4d8',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
};

const btnGhostStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid transparent',
  background: 'transparent',
  cursor: 'pointer',
  color: '#374151',
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: 'white',
  cursor: 'pointer',
};

function inputTypeFor(widget: EditableWidget): string {
  switch (widget) {
    case 'number':
    case 'currency':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

function coerce(raw: string, widget: EditableWidget): unknown {
  if (raw === '') return undefined;
  if (widget === 'number' || widget === 'currency') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  return raw;
}
