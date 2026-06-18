import type { SearchHit } from '@org/api-client';
import { Dialog, DialogContent, DialogTitle, Spinner } from '@org/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSearch } from './queries';
import { Highlighted, hrefForHit } from './highlight';

/** Fires from anywhere (e.g. a header button) to open the palette. */
export const OPEN_SEARCH_EVENT = 'open-search-palette';
export function openSearchPalette() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/**
 * Global ⌘K / Ctrl-K quick search. Mounted once (in MainLayout). Debounced,
 * fully keyboard-driven (↑/↓ to move, Enter to open, Esc to close), grouped by
 * kind. Reuses the same `/search` endpoint as the full page.
 */
export function SearchCommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Global hotkey + external open events.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, []);

  // Reset transient state when closed.
  useEffect(() => {
    if (!open) {
      setInput('');
      setQ('');
      setActive(0);
    }
  }, [open]);

  // Debounce the query.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(input.trim());
      setActive(0);
    }, 200);
    return () => clearTimeout(id);
  }, [input]);

  const enabled = q.length > 0;
  const { data, isFetching } = useSearch({ q, page: 0, pageSize: 8 }, enabled);
  const items = useMemo<SearchHit[]>(() => data?.items ?? [], [data?.items]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    navigate(hrefForHit(hit));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault();
      go(items[active]);
    }
  };

  // Keep the active row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${active}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">
          {t('search.title', 'Search')}
        </DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <SearchGlyph />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('search.placeholder', 'Search documents…')}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Spinner className="h-4 w-4" />}
          <kbd className="hidden rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {!enabled ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t(
                'search.paletteHint',
                'Search your drafts and uploads. Use ↑ ↓ and Enter.',
              )}
            </p>
          ) : items.length === 0 && !isFetching ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('search.noResults', 'No matches found.')}
            </p>
          ) : (
            items.map((hit, i) => (
              <button
                key={`${hit.kind}:${hit.refId}`}
                data-idx={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit)}
                className={`flex w-full items-start gap-2.5 px-3 py-2 text-left ${
                  i === active ? 'bg-secondary' : ''
                }`}
              >
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    hit.kind === 'document'
                      ? 'bg-primary/50 text-primary'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {hit.kind === 'document'
                    ? t('search.draft', 'Draft')
                    : t('search.upload', 'Upload')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    <Highlighted text={hit.titleSnippet || hit.title} />
                  </span>
                  {hit.snippet && (
                    <span className="line-clamp-1 block text-xs text-muted-foreground">
                      <Highlighted text={hit.snippet} />
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>

        {enabled && items.length > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground">
            <span>
              {data?.meta.semantic
                ? t('search.semanticOn', 'Semantic on')
                : t('search.keyword', 'Keyword')}
            </span>
            <span>↑ ↓ Enter</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SearchGlyph() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-muted-foreground"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
