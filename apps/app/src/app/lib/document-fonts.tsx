import { useEffect, useState } from 'react';
import { cn } from '@org/utils';

/**
 * Popular Google Fonts surfaced as quick-picks, weighted toward India-first /
 * Devanagari-capable families. The picker is a free-text combobox, so ANY
 * Google Fonts family name works — these are just suggestions.
 */
export const FONT_SUGGESTIONS: string[] = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Source Sans 3',
  'Merriweather',
  'Lora',
  'Playfair Display',
  'PT Serif',
  'EB Garamond',
  'Tinos',
  'Noto Sans',
  'Noto Serif',
  'Noto Sans Devanagari',
  'Noto Serif Devanagari',
  'Mukta',
  'Hind',
  'Tiro Devanagari Hindi',
  'Baloo 2',
];

/**
 * Document-level font picker. Free text (any Google Fonts family) with a
 * datalist of common families. To avoid loading a font on every keystroke, the
 * value is committed on blur, on Enter, or when an exact suggestion is picked.
 * An empty value means "use the default" (bundled Inter).
 */
export function DocumentFontSelect({
  value,
  onChange,
  className,
  title = 'Document font',
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  className?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState(value ?? '');
  // Keep the input in sync if the document's font changes elsewhere.
  useEffect(() => setDraft(value ?? ''), [value]);

  const commit = (raw: string) => {
    const next = raw.trim();
    if (next !== (value ?? '')) onChange(next || undefined);
  };

  const listId = 'doc-font-suggestions';
  return (
    <>
      <input
        type="text"
        title={title}
        list={listId}
        value={draft}
        placeholder="Inter (default)"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          // Picking a suggestion fires a change with the full family — commit it
          // immediately so the document updates without needing to blur.
          if (FONT_SUGGESTIONS.includes(v.trim())) commit(v);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'h-8 w-36 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40',
          className,
        )}
        style={
          value
            ? { fontFamily: `'${value.replace(/'/g, '')}', Inter, sans-serif` }
            : undefined
        }
      />
      <datalist id={listId}>
        {FONT_SUGGESTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </>
  );
}
