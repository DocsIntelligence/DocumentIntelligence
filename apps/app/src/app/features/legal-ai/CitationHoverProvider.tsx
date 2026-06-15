import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_ENV, lawUrl } from '../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

interface PublicCitation {
  id: string;
  act: string;
  actShort?: string;
  section?: string;
  title: string;
  summary: string;
  confidence: 'high' | 'moderate' | 'low';
  effectiveFrom?: string;
  supersedes?: string;
}

interface HoverState {
  id: string;
  x: number;
  y: number;
}

// Process-local cache: every doc that renders multiple citations shares one
// fetch per id across components + remounts. Citations are tiny (< 2 KB).
const cache = new Map<string, PublicCitation>();

async function fetchCitation(id: string): Promise<PublicCitation | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  const safe = encodeURIComponent(id);
  try {
    // Logged-in path first (full catalog incl. private rows); fall back to
    // the public endpoint so the same component works on /law/:id too.
    let res = await fetch(`${API_BASE_URL}/legal-ai/citations/${safe}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      res = await fetch(`${API_BASE_URL}/public/law/${safe}`);
    }
    if (!res.ok) return null;
    const c = (await res.json()) as PublicCitation;
    cache.set(id, c);
    return c;
  } catch {
    return null;
  }
}

/**
 * Mount inside any container that may render `<a data-citation-id="…">`
 * citation spans (CitationFillerService output). Listens for pointerover
 * on the ref'd container and shows a floating tooltip with the citation's
 * title + summary + a "Read more →" link.
 *
 * Zero context switch — the user reads what the section says without leaving
 * the document. Matches the universal pattern from Notion / Wikipedia /
 * arXiv hover-previews. Works in BOTH editors (BuilderShell preview pane,
 * DraftEditor preview pane) and on /law/:id since spans use the same
 * data-citation-id attribute regardless of where they were rendered.
 *
 * Why a custom impl instead of a tooltip lib: we already have radix-ui's
 * tooltip but it expects per-element bindings. We need delegated event
 * handling because citation spans are inside Tiptap / artboard HTML that
 * we don't own at render time.
 */
export function CitationHoverProvider({
  containerRef,
}: {
  /** Ref to the DOM element whose descendants may include citation spans. */
  containerRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<HoverState | null>(null);
  const [citation, setCitation] = useState<PublicCitation | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const cancelClose = () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
    const scheduleClose = () => {
      cancelClose();
      closeTimerRef.current = setTimeout(() => {
        setHover(null);
        setCitation(null);
      }, 150);
    };

    const onOver = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.(
        '[data-citation-id]',
      ) as HTMLElement | null;
      if (!target) return;
      const id = target.getAttribute('data-citation-id');
      if (!id) return;
      cancelClose();
      const rect = target.getBoundingClientRect();
      setHover({
        id,
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 6,
      });
      // Fetch (cached). Skip stale set when the user has already moved off.
      void fetchCitation(id).then((c) => {
        if (!c) return;
        setHover((prev) => (prev && prev.id === id ? prev : prev));
        setCitation((prev) =>
          prev && prev.id === id ? prev : c.id === id ? c : prev,
        );
      });
    };

    const onLeave = (e: PointerEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related?.closest?.('[data-citation-hover-card]')) return;
      scheduleClose();
    };

    el.addEventListener('pointerover', onOver);
    el.addEventListener('pointerout', onLeave);
    return () => {
      el.removeEventListener('pointerover', onOver);
      el.removeEventListener('pointerout', onLeave);
      cancelClose();
    };
  }, [containerRef]);

  if (!hover || !citation || citation.id !== hover.id) return null;

  return (
    <div
      data-citation-hover-card
      onMouseEnter={() => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
      }}
      onMouseLeave={() => setHover(null)}
      style={{
        position: 'absolute',
        top: hover.y,
        left: Math.min(hover.x, window.innerWidth - 380),
        zIndex: 1000,
      }}
      className="w-[360px] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-4 text-sm"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex items-center rounded-full bg-info text-info-foreground px-2 py-0.5 text-[10px] font-medium">
          {citation.actShort ?? citation.act}
          {citation.section ? ` §${citation.section}` : ''}
        </span>
        {citation.confidence === 'high' && (
          <span className="text-[10px] text-success">verified</span>
        )}
        {citation.effectiveFrom && (
          <span className="text-[10px] text-foreground/50">
            eff. {citation.effectiveFrom}
          </span>
        )}
      </div>
      <h4 className="font-medium leading-snug">{citation.title}</h4>
      <p className="mt-1.5 text-xs text-foreground/70 leading-snug line-clamp-5">
        {citation.summary}
      </p>
      {citation.supersedes && (
        <p className="mt-1.5 text-[11px] text-warning">
          {t('citationHover.replaces', 'Replaces {{id}}', {
            id: citation.supersedes,
          })}
        </p>
      )}
      <a
        href={lawUrl(citation.id)}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-xs text-primary hover:underline"
      >
        {t('citationHover.readMore', 'Read full reference →')}
      </a>
    </div>
  );
}
