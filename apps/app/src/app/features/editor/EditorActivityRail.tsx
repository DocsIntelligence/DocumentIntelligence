import { type ReactNode } from 'react';

/**
 * A single side-menu entry. Two kinds:
 *  • `panel`  — clicking switches the active section shown next to the menu.
 *  • `action` — clicking dispatches a callback (typically opens a dialog).
 *
 * `badge` shows a small number/string pill (e.g. `3` open comments,
 * `2/5` filled fields).
 */
export interface RailItem {
  id: string;
  icon: ReactNode;
  label: string;
  kind: 'panel' | 'action';
  /** Optional group header — items sharing a `group` cluster together. */
  group?: string;
  active?: boolean;
  badge?: string | number;
  onClick: () => void;
}

/**
 * Labeled side menu used by BuilderShell (structured docs) and TemplateEditor
 * (freeform). Shows a column of icon+label rows grouped under section headers.
 * Both editors get the same shape:
 *   Content     → Fields · Pages
 *   AI          → Legal & AI
 *   Collaborate → Comments · History · Signatures · Share
 *
 * Items with `kind: 'panel'` switch the section content rendered to the
 * right; items with `kind: 'action'` dispatch their callback (a dialog
 * the parent owns, typically). The caller decides which is which.
 *
 * Items are rendered in declaration order; group headers appear between
 * groups when the `group` field changes (or stay implicit if no groups
 * are declared).
 */
export function EditorSideMenu({
  items,
  footer,
}: {
  items: RailItem[];
  /** Rendered at the very bottom of the menu (e.g. a Customize button). */
  footer?: ReactNode;
}) {
  let lastGroup: string | undefined;
  return (
    <nav
      aria-label="Editor sections"
      className="flex h-full w-44 flex-none flex-col border-r border-border bg-secondary/15"
    >
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {items.map((it) => {
          const showHeader = it.group && it.group !== lastGroup;
          lastGroup = it.group;
          return (
            <div key={it.id} className="flex flex-col gap-0.5">
              {showHeader && (
                <div className="mt-1.5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                  {it.group}
                </div>
              )}
              <MenuButton item={it} />
            </div>
          );
        })}
      </div>
      {footer && (
        <div className="flex-none border-t border-border px-1.5 py-1.5">
          {footer}
        </div>
      )}
    </nav>
  );
}

function MenuButton({ item }: { item: RailItem }) {
  return (
    <button
      type="button"
      aria-pressed={item.kind === 'panel' ? !!item.active : undefined}
      onClick={item.onClick}
      className={`mx-1.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors ${
        item.active
          ? 'bg-primary/15 text-primary'
          : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
      }`}
    >
      <span className="flex size-4 flex-none items-center justify-center">
        {item.icon}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge !== '' && (
        <span className="inline-flex h-4 min-w-[18px] flex-none items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
          {item.badge}
        </span>
      )}
      {item.kind === 'action' && (
        <span aria-hidden className="flex-none text-foreground/35">
          ›
        </span>
      )}
    </button>
  );
}

/** Backwards-compat alias — old imports keep working. */
export const EditorActivityRail = EditorSideMenu;
