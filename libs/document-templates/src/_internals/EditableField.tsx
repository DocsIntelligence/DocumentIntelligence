import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useEditContext, type EditableWidget } from './edit-context';

interface Props {
  path: string;
  value: unknown;
  widget?: EditableWidget;
  placeholder?: string;
  children?: ReactNode;
}

const STYLE_EDITABLE_FILLED: CSSProperties = {
  cursor: 'pointer',
  borderBottom: '1px dashed transparent',
  borderRadius: 2,
  padding: '0 2px',
  margin: '0 -2px',
  transition: 'background-color 80ms, border-color 80ms',
};

const STYLE_EDITABLE_EMPTY: CSSProperties = {
  cursor: 'pointer',
  display: 'inline-block',
  minWidth: '6ch',
  borderBottom: '1px dashed #6b7280',
  color: '#6b7280',
  borderRadius: 2,
  padding: '0 4px',
  margin: '0 -4px',
};

const STYLE_READONLY_EMPTY: CSSProperties = {
  color: '#6b7280',
};

/**
 * Wraps a piece of template text so clicking it opens an in-place editor.
 *
 *   editable = true  → click-to-edit chip. The displayed text is `children`
 *                      if provided (e.g. a formatted currency), otherwise
 *                      the stringified `value` or the placeholder.
 *   editable = false → renders as plain text, no click handler. This is
 *                      what the Puppeteer/PDF path gets, since no provider
 *                      is mounted at the top of the tree.
 *
 * `path` is the dotted field path on the document `data` object, e.g.
 * "parties.landlord.name". The popover in the parent resolves the
 * matching widget + label via `bundle.formMetadata[path]`.
 */
export function EditableField({
  path,
  value,
  widget = 'text',
  placeholder,
  children,
}: Props) {
  const { editable, onFieldClick } = useEditContext();
  const isEmpty =
    value === undefined ||
    value === null ||
    value === '' ||
    (typeof value === 'number' && Number.isNaN(value));

  const displayed: ReactNode =
    children ?? (isEmpty ? (placeholder ?? '—') : String(value));

  if (!editable) {
    return (
      <span style={isEmpty ? STYLE_READONLY_EMPTY : undefined}>
        {displayed}
      </span>
    );
  }

  function handleClick(ev: MouseEvent<HTMLSpanElement>) {
    if (!onFieldClick) return;
    ev.stopPropagation();
    const target = ev.currentTarget;
    const r = target.getBoundingClientRect();
    onFieldClick({
      path,
      value,
      widget,
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    });
  }

  return (
    <span
      data-editable-path={path}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as MouseEvent<HTMLSpanElement>);
        }
      }}
      style={isEmpty ? STYLE_EDITABLE_EMPTY : STYLE_EDITABLE_FILLED}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.10)';
        e.currentTarget.style.borderBottomColor = '#3b82f6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.borderBottomColor = isEmpty
          ? '#6b7280'
          : 'transparent';
      }}
    >
      {displayed}
    </span>
  );
}
