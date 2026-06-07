import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

export const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type PlaceholderHighlightOptions = {
  /** Map of resolved values keyed by placeholder name. Filled tokens render with a different style. */
  values: Record<string, string>;
  /** Called when user clicks a token in the editor (key passed in). */
  onTokenClick?: (key: string) => void;
};

const KEY = new PluginKey('placeholder-highlight');
export const PLACEHOLDER_HIGHLIGHT_META = 'placeholder-highlight:refresh';

function buildDecorations(
  doc: PMNode,
  values: Record<string, string>,
): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let m: RegExpExecArray | null;
    PLACEHOLDER_REGEX.lastIndex = 0;
    while ((m = PLACEHOLDER_REGEX.exec(text)) !== null) {
      const from = pos + m.index;
      const to = from + m[0].length;
      const key = m[1];
      const filled = !!values[key]?.trim();
      decos.push(
        Decoration.inline(from, to, {
          class: filled
            ? 'placeholder-token placeholder-token--filled'
            : 'placeholder-token placeholder-token--empty',
          'data-placeholder-key': key,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

export const PlaceholderHighlightExtension =
  Extension.create<PlaceholderHighlightOptions>({
    name: 'placeholderHighlight',

    addOptions() {
      return { values: {}, onTokenClick: undefined };
    },

    addStorage() {
      return { values: this.options.values };
    },

    addProseMirrorPlugins() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const extension = this;
      return [
        new Plugin({
          key: KEY,
          state: {
            init(_, { doc }) {
              return buildDecorations(doc, extension.storage.values);
            },
            apply(tr, old) {
              if (tr.docChanged || tr.getMeta(PLACEHOLDER_HIGHLIGHT_META)) {
                return buildDecorations(tr.doc, extension.storage.values);
              }
              return old.map(tr.mapping, tr.doc);
            },
          },
          props: {
            decorations(state) {
              return KEY.getState(state);
            },
            handleClick(view, _pos, event) {
              const target = event.target as HTMLElement | null;
              const tokenEl = target?.closest('[data-placeholder-key]');
              if (tokenEl) {
                const key = tokenEl.getAttribute('data-placeholder-key');
                if (key) {
                  extension.options.onTokenClick?.(key);
                  return true;
                }
              }
              return false;
            },
          },
        }),
      ];
    },
  });

/** Pull every {{key}} found in an HTML string. Order preserved, duplicates removed. */
export function extractPlaceholderKeys(html: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER_REGEX.lastIndex = 0;
  while ((m = PLACEHOLDER_REGEX.exec(html)) !== null) {
    const key = m[1];
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** Replace {{key}} tokens in an HTML string with their values (HTML-escaped). Unfilled tokens become a styled fallback span. */
export function renderTemplateHtml(
  html: string,
  values: Record<string, string>,
): string {
  return html.replace(PLACEHOLDER_REGEX, (_full, key: string) => {
    const v = values[key];
    if (v && v.trim()) return escapeHtml(v);
    return `<span class="placeholder-token placeholder-token--empty">[${escapeHtml(key)}]</span>`;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
