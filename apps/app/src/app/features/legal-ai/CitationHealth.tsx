import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge, Button, Spinner, Textarea } from '@org/ui';
import { APP_ENV, lawUrl } from '../../../config';
import { ReformBadge } from '../admin/legal-reference/ReformLookup';
import { CitationHoverProvider } from './CitationHoverProvider';

interface Citation {
  id: string;
  act: string;
  actShort?: string;
  section?: string;
  title: string;
  summary: string;
  confidence: 'high' | 'moderate' | 'low';
  topics?: string[];
  appliesTo?: string[];
}

interface Analysis {
  documentTypeKey?: string;
  present: { citation: Citation; occurrences: number; status: string }[];
  stale: {
    matched: string;
    finding: { code: string; section?: string; message: string };
    suggestion?: Citation;
  }[];
  missing: { citation: Citation; reason: string }[];
  suggestions: { citation: Citation; reason: string }[];
  ok: boolean;
}

interface CritiqueIssue {
  category: string;
  citationId?: string;
  title: string;
  detail: string;
  proposedText?: string;
  severity: 'high' | 'medium' | 'low';
}
interface Critique {
  documentId: string;
  model: string;
  groundedOn: Array<{ id: string; title: string }>;
  issues: CritiqueIssue[];
  ok: boolean;
  cached?: boolean;
}

interface Suggestion {
  citation: {
    id: string;
    act: string;
    actShort?: string;
    section?: string;
    title: string;
  };
  confidence: 'high' | 'moderate' | 'low';
  reason: string;
}

const API_BASE_URL = APP_ENV.apiUrl;
const SEVERITY_VARIANT: Record<string, 'error' | 'warning' | 'info'> = {
  high: 'error',
  medium: 'warning',
  low: 'info',
};

/**
 * Citation panel — tight, one-screen layout for a narrow side rail:
 *
 *   ┌─────────────────────────────────────────┐
 *   │ ✓ 3 cited · ⚠ 1 stale · + 2 missing     │  ← live status strip
 *   │                       [ Improve with AI ▾ ]
 *   ├─────────────────────────────────────────┤
 *   │ ✓ NI §138              ×3       open ↗  │
 *   │ ✓ NI §141              ×1       open ↗  │
 *   │ ⚠ CrPC §200    [→ Update to BNSS §223]  │
 *   │ + NI §142      [ Insert ]               │
 *   └─────────────────────────────────────────┘
 *
 * Every row is the same shape — status glyph + label + right-aligned action.
 * "Improve with AI" is a single CTA that toggles a small workspace below
 * with two tools (Suggest + Critique). One tab in DocumentSidePanel, one
 * inline expander here — never two unrelated trays open at once.
 */
export function CitationHealth({ documentId }: { documentId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [improvePane, setImprovePane] = useState<
    'closed' | 'suggest' | 'critique'
  >('closed');

  // Suggest state
  const [suggestText, setSuggestText] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  // Critique state
  const [critique, setCritique] = useState<Critique | null>(null);
  const [critiquing, setCritiquing] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const refresh = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/legal-ai/citations/document/${documentId}/analyze`, {
      credentials: 'include',
    })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((d) => setData(d as Analysis))
      .catch((err) =>
        toast.error(
          t('legalRefs.loadFailed', 'Failed to analyse citations: {{m}}', {
            m: (err as Error).message,
          }),
        ),
      )
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [documentId]);

  const applyFix = async (
    action:
      | { kind: 'replace-stale'; matched: string; successorId: string }
      | { kind: 'insert-missing'; citationId: string }
      | {
          kind: 'apply-suggestion';
          proposedText: string;
          citationId?: string;
          replaceMatch?: string;
        },
    keyOverride?: string,
  ) => {
    const key =
      keyOverride ??
      (action.kind === 'replace-stale'
        ? `replace:${action.matched}:${action.successorId}`
        : action.kind === 'insert-missing'
          ? `insert:${action.citationId}`
          : `apply-suggestion:${action.citationId ?? 'gen'}`);
    setApplying(key);
    try {
      const res = await fetch(
        `${API_BASE_URL}/legal-ai/citations/document/${documentId}/apply-fix`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? JSON.stringify(body));
      toast.success(body.appliedDescription ?? t('legalRefs.applied', 'Applied'));
      setData(body.analysis as Analysis);
    } catch (err) {
      toast.error(`Fix failed: ${(err as Error).message}`);
    } finally {
      setApplying(null);
    }
  };

  const runSuggest = async () => {
    const text = suggestText.trim();
    if (!text) {
      toast.info(
        t(
          'legalRefs.suggestNeedsText',
          'Paste a clause / sentence — the model needs something to suggest citations for.',
        ),
      );
      return;
    }
    setSuggesting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/legal-ai/citations/suggest-for-text`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? JSON.stringify(body));
      setSuggestions((body.suggestions ?? []) as Suggestion[]);
    } catch (err) {
      toast.error(`Suggest failed: ${(err as Error).message}`);
    } finally {
      setSuggesting(false);
    }
  };

  const runCritique = async (force = false) => {
    setCritiquing(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/legal-ai/citations/document/${documentId}/critique${force ? '?force=1' : ''}`,
        { method: 'POST', credentials: 'include' },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? JSON.stringify(body));
      setCritique(body as Critique);
    } catch (err) {
      toast.error(`Critique failed: ${(err as Error).message}`);
    } finally {
      setCritiquing(false);
    }
  };

  const counts = useMemo(() => {
    if (!data) return { present: 0, stale: 0, missing: 0 };
    return {
      present: data.present.length,
      stale: data.stale.length,
      missing: data.missing.length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground/60 py-6 justify-center">
        <Spinner className="size-4" />
        <span>{t('legalRefs.loading', 'Analysing citations…')}</span>
      </div>
    );
  }
  if (!data) return null;

  const empty =
    data.present.length === 0 &&
    data.stale.length === 0 &&
    data.missing.length === 0 &&
    data.suggestions.length === 0;

  return (
    <div ref={containerRef} className="space-y-3">
      <CitationHoverProvider containerRef={containerRef} />

      {/* Status strip ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground/70">
          <Stat tone="success" label={`${counts.present} cited`} />
          {counts.stale > 0 && (
            <Stat tone="warning" label={`${counts.stale} stale`} />
          )}
          {counts.missing > 0 && (
            <Stat tone="info" label={`${counts.missing} missing`} />
          )}
          {empty && (
            <span className="text-foreground/45">
              {t('legalRefs.noneYet', 'No citations detected yet.')}
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <ReformBadge />
          <Button
            size="sm"
            variant="ghost"
            onClick={refresh}
            title={t('common.refresh', 'Refresh')}
            className="h-6 px-1.5 text-foreground/50"
          >
            ↻
          </Button>
        </div>
      </div>

      {/* Improve with AI — one CTA, two tools, mutually exclusive ──── */}
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={improvePane === 'suggest' ? 'primary' : 'outline'}
          className="flex-1 h-7 text-xs"
          onClick={() =>
            setImprovePane(improvePane === 'suggest' ? 'closed' : 'suggest')
          }
        >
          {t('legalRefs.suggestCta', 'Suggest for clause')}
        </Button>
        <Button
          size="sm"
          variant={improvePane === 'critique' ? 'primary' : 'outline'}
          className="flex-1 h-7 text-xs"
          onClick={() => {
            if (improvePane !== 'critique' && !critique) runCritique(false);
            setImprovePane(improvePane === 'critique' ? 'closed' : 'critique');
          }}
        >
          {critiquing ? <Spinner className="size-3" /> : t('legalRefs.critique', 'Critique')}
        </Button>
      </div>

      {improvePane === 'suggest' && (
        <SuggestPane
          text={suggestText}
          onTextChange={setSuggestText}
          busy={suggesting}
          suggestions={suggestions}
          onRun={runSuggest}
          onInsert={(id) =>
            applyFix({ kind: 'insert-missing', citationId: id })
          }
          applyingKey={applying}
        />
      )}

      {improvePane === 'critique' && (
        <CritiquePane
          critique={critique}
          critiquing={critiquing}
          onRecompute={() => runCritique(true)}
          applyingKey={applying}
          onApply={(issue, idx) =>
            applyFix(
              {
                kind: 'apply-suggestion',
                proposedText: issue.proposedText ?? '',
                citationId: issue.citationId,
              },
              `apply-suggestion:${idx}`,
            )
          }
        />
      )}

      {/* Unified citation list ─────────────────────────────────────────── */}
      <ul className="divide-y divide-border/40 -mx-1">
        {data.present.map((p) => (
          <Row
            key={`p:${p.citation.id}`}
            tone="success"
            symbol="✓"
            href={lawUrl(p.citation.id)}
            citationId={p.citation.id}
            label={`${p.citation.actShort ?? p.citation.act}${p.citation.section ? ` §${p.citation.section}` : ''}`}
            sublabel={p.citation.title}
            trailing={
              <span className="text-[10px] text-foreground/45 tabular-nums">
                ×{p.occurrences}
              </span>
            }
          />
        ))}
        {data.stale.map((s, i) => {
          const sug = s.suggestion;
          const fixKey = sug ? `replace:${s.matched}:${sug.id}` : '';
          return (
            <Row
              key={`s:${i}`}
              tone="warning"
              symbol="⚠"
              href={sug ? lawUrl(sug.id) : undefined}
              citationId={sug?.id}
              label={`${s.finding.code}${s.finding.section ? ` §${s.finding.section}` : ''}`}
              sublabel={s.matched}
              trailing={
                sug ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    disabled={applying === fixKey}
                    onClick={() =>
                      applyFix({
                        kind: 'replace-stale',
                        matched: s.matched,
                        successorId: sug.id,
                      })
                    }
                  >
                    {applying === fixKey ? (
                      <Spinner className="size-3" />
                    ) : (
                      `→ ${sug.actShort ?? sug.act} §${sug.section}`
                    )}
                  </Button>
                ) : null
              }
            />
          );
        })}
        {data.missing.map((m) => (
          <Row
            key={`m:${m.citation.id}`}
            tone="info"
            symbol="+"
            href={lawUrl(m.citation.id)}
            citationId={m.citation.id}
            label={`${m.citation.actShort ?? m.citation.act}${m.citation.section ? ` §${m.citation.section}` : ''}`}
            sublabel={m.citation.title}
            trailing={
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px]"
                disabled={applying === `insert:${m.citation.id}`}
                onClick={() =>
                  applyFix({
                    kind: 'insert-missing',
                    citationId: m.citation.id,
                  })
                }
              >
                {applying === `insert:${m.citation.id}` ? (
                  <Spinner className="size-3" />
                ) : (
                  t('legalRefs.insert', 'Insert')
                )}
              </Button>
            }
          />
        ))}
        {data.suggestions.map((s) => (
          <Row
            key={`x:${s.citation.id}`}
            tone="muted"
            symbol="·"
            href={lawUrl(s.citation.id)}
            citationId={s.citation.id}
            label={`${s.citation.actShort ?? s.citation.act}${s.citation.section ? ` §${s.citation.section}` : ''}`}
            sublabel={s.reason}
            trailing={
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[10px]"
                disabled={applying === `insert:${s.citation.id}`}
                onClick={() =>
                  applyFix({
                    kind: 'insert-missing',
                    citationId: s.citation.id,
                  })
                }
              >
                {applying === `insert:${s.citation.id}` ? (
                  <Spinner className="size-3" />
                ) : (
                  t('legalRefs.add', 'Add')
                )}
              </Button>
            }
          />
        ))}
      </ul>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function Stat({
  tone,
  label,
}: {
  tone: 'success' | 'warning' | 'info';
  label: string;
}) {
  const dot =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
        ? 'bg-warning'
        : 'bg-info';
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Row({
  tone,
  symbol,
  label,
  sublabel,
  trailing,
  href,
  citationId,
}: {
  tone: 'success' | 'warning' | 'info' | 'muted';
  symbol: string;
  label: string;
  sublabel: string;
  trailing?: React.ReactNode;
  href?: string;
  citationId?: string;
}) {
  const toneCls =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'info'
          ? 'text-info'
          : 'text-foreground/40';

  const Wrapper = href
    ? ({ children }: { children: React.ReactNode }) => (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          data-citation-id={citationId}
          className="min-w-0 flex-1 hover:text-primary"
        >
          {children}
        </a>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div className="min-w-0 flex-1">{children}</div>
      );

  return (
    <li className="flex items-start gap-2 px-1 py-1.5">
      <span
        className={`mt-0.5 flex-none w-3 text-center text-xs font-medium ${toneCls}`}
        aria-hidden
      >
        {symbol}
      </span>
      <Wrapper>
        <div className="text-xs font-medium text-foreground truncate">
          {label}
        </div>
        <div className="text-[11px] text-foreground/55 truncate">{sublabel}</div>
      </Wrapper>
      {trailing && <div className="flex-none">{trailing}</div>}
    </li>
  );
}

function SuggestPane({
  text,
  onTextChange,
  busy,
  suggestions,
  onRun,
  onInsert,
  applyingKey,
}: {
  text: string;
  onTextChange: (v: string) => void;
  busy: boolean;
  suggestions: Suggestion[] | null;
  onRun: () => void;
  onInsert: (id: string) => void;
  applyingKey: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-dashed border-border/70 p-2 space-y-2">
      <Textarea
        rows={3}
        placeholder={t(
          'legalRefs.suggestPlaceholder',
          'Paste the clause — model returns ranked citations from the catalog.',
        )}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        className="text-xs"
      />
      <Button
        size="sm"
        className="h-7 w-full text-xs"
        onClick={onRun}
        disabled={busy}
      >
        {busy ? <Spinner className="size-3" /> : t('legalRefs.suggestRun', 'Rank citations')}
      </Button>
      {suggestions && suggestions.length === 0 && (
        <p className="text-[11px] text-foreground/50">
          {t('legalRefs.suggestEmpty', 'No matches in the curated catalog.')}
        </p>
      )}
      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {suggestions.map((s) => {
            const key = `insert:${s.citation.id}`;
            return (
              <li
                key={s.citation.id}
                className="flex items-start gap-2 text-xs"
              >
                <Badge
                  variant={
                    s.confidence === 'high'
                      ? 'success'
                      : s.confidence === 'low'
                        ? 'error'
                        : 'warning'
                  }
                  outline
                  className="text-[10px] mt-0.5"
                >
                  {s.confidence}
                </Badge>
                <a
                  href={lawUrl(s.citation.id)}
                  target="_blank"
                  rel="noreferrer"
                  data-citation-id={s.citation.id}
                  className="min-w-0 flex-1 hover:text-primary"
                >
                  <div className="font-medium text-foreground truncate">
                    {s.citation.actShort ?? s.citation.act}
                    {s.citation.section ? ` §${s.citation.section}` : ''}
                  </div>
                  <div className="text-[11px] text-foreground/55 line-clamp-2">
                    {s.reason}
                  </div>
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px] flex-none"
                  disabled={applyingKey === key}
                  onClick={() => onInsert(s.citation.id)}
                >
                  {applyingKey === key ? (
                    <Spinner className="size-3" />
                  ) : (
                    t('legalRefs.insert', 'Insert')
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CritiquePane({
  critique,
  critiquing,
  onRecompute,
  applyingKey,
  onApply,
}: {
  critique: Critique | null;
  critiquing: boolean;
  onRecompute: () => void;
  applyingKey: string | null;
  onApply: (issue: CritiqueIssue, idx: number) => void;
}) {
  const { t } = useTranslation();

  if (critiquing && !critique) {
    return (
      <div className="rounded-md border border-dashed border-border/70 p-3 flex items-center gap-2 text-xs text-foreground/60">
        <Spinner className="size-3.5" />
        {t('legalRefs.critiquing', 'Running AI critique…')}
      </div>
    );
  }
  if (!critique) return null;

  return (
    <div className="rounded-md border border-dashed border-border/70 p-2 space-y-2">
      <div className="flex items-center justify-between text-[10px] text-foreground/55">
        <span>
          {t('legalRefs.groundedOn', 'grounded on {{n}} citation(s)', {
            n: critique.groundedOn.length,
          })}
          {critique.cached && (
            <span className="ml-1.5 text-success/80">· cached</span>
          )}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 px-1.5 text-[10px]"
          onClick={onRecompute}
        >
          {t('legalRefs.recompute', 'Recompute')}
        </Button>
      </div>
      {critique.issues.length === 0 ? (
        <p className="text-xs text-success">
          {t(
            'legalRefs.critiqueClean',
            'No material issues against the cited sections.',
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {critique.issues.map((issue, i) => {
            const key = `apply-suggestion:${i}`;
            return (
              <li key={i} className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Badge
                      variant={SEVERITY_VARIANT[issue.severity] ?? 'info'}
                      className="text-[10px] mt-0.5 flex-none"
                    >
                      {issue.severity}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {issue.title}
                      </p>
                      <p className="text-[11px] text-foreground/65 leading-snug">
                        {issue.detail}
                      </p>
                    </div>
                  </div>
                  {issue.proposedText && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] flex-none"
                      disabled={applyingKey === key}
                      onClick={() => onApply(issue, i)}
                    >
                      {applyingKey === key ? (
                        <Spinner className="size-3" />
                      ) : (
                        t('legalRefs.applySuggestion', 'Apply')
                      )}
                    </Button>
                  )}
                </div>
                {issue.proposedText && (
                  <pre className="text-[10px] text-foreground/70 bg-secondary/40 rounded p-1.5 whitespace-pre-wrap font-mono">
                    {issue.proposedText}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CitationHealth;
