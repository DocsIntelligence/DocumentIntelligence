import {
  getBundle,
  type Warning,
} from '@org/document-schema';
import type { FieldClickEvent } from '@org/document-templates';
import { useDebounce } from '@org/hooks';
import { Button, Card } from '@org/ui';
import { cn } from '@org/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useDocument, usePatchDocument } from '../queries';
import { useLegalAiService } from '../services-context';
import { ArtboardIframe } from './ArtboardIframe';
import { BuilderForm, type BuilderFormHandle } from './BuilderForm';
import { InlineEditPopover } from './InlineEditPopover';
import { RisksPanel } from './RisksPanel';
import { SectionsTree } from './SectionsTree';
import { labelFor } from './sectionLabels';
import { useExportPdf } from './useExportPdf';

interface InlineEditState {
  event: FieldClickEvent;
  iframeRect: { top: number; left: number };
}

interface Props {
  documentId: string;
}

/**
 * Three-pane builder shell. Owns:
 *   - draft state (local; debounced PATCH to API)
 *   - risk evaluation (sync, derived from schema lib)
 *   - section navigation
 *   - AI assist on fields
 *
 * The artboard is one-way fed via postMessage. The schema lib provides
 * the source of truth for form metadata, risks, and known templates.
 */
export function BuilderShell({ documentId }: Props) {
  const { data: doc, isLoading } = useDocument(documentId);
  const patch = usePatchDocument(documentId);
  const { mutate: patchMutate } = patch;
  const legalAi = useLegalAiService();

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [draftTitle, setDraftTitle] = useState('');
  const [aiBusyField, setAiBusyField] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  // Small screens show one pane at a time (form | preview); lg+ shows both.
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const formRef = useRef<BuilderFormHandle | null>(null);
  const { state: exportState, start: startExport } = useExportPdf(documentId);

  // Auto-open the download URL once the PDF is ready.
  useEffect(() => {
    if (exportState.phase === 'ready') {
      window.open(exportState.url, '_blank', 'noopener,noreferrer');
      toast.success('PDF ready — opened in a new tab');
    }
    if (exportState.phase === 'failed') {
      toast.error(`Export failed: ${exportState.error}`);
    }
  }, [exportState]);

  // Hydrate once per document id. Tracks the last-saved snapshot so the
  // autosave effect can no-op when the debounced draft hasn't diverged.
  const lastSavedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!doc) return;
    const data = (doc.data as Record<string, unknown>) ?? {};
    setDraft(data);
    setDraftTitle(doc.title);
    lastSavedRef.current = JSON.stringify({ data, title: doc.title });
  }, [doc?.id]);

  // Debounced autosave. Deps intentionally exclude `doc` and `patch` —
  // both update on every mutation success and would otherwise re-fire
  // this effect in a loop. `patchMutate` is stable across renders.
  const debouncedDraft = useDebounce(draft, 800);
  const debouncedTitle = useDebounce(draftTitle, 800);

  useEffect(() => {
    if (!lastSavedRef.current) return;
    const serialized = JSON.stringify({
      data: debouncedDraft,
      title: debouncedTitle,
    });
    if (serialized === lastSavedRef.current) return;
    lastSavedRef.current = serialized;
    patchMutate({ data: debouncedDraft, title: debouncedTitle });
  }, [debouncedDraft, debouncedTitle, patchMutate]);

  // Schema + risks.
  const bundle = useMemo(() => {
    if (!doc?.documentType?.key) return null;
    return getBundle(doc.documentType.key) ?? null;
  }, [doc?.documentType?.key]);

  const warnings: Warning[] = useMemo(() => {
    if (!bundle) return [];
    try {
      return bundle.risks(draft);
    } catch {
      return [];
    }
  }, [bundle, draft]);

  // AI assist (clause rewrite on a single field's text value).
  async function onAiAssist(promptKey: string, fieldPath: string) {
    if (!doc?.documentType?.key) return;
    const current = getAtPath(draft, fieldPath);
    if (typeof current !== 'string' || !current.trim()) {
      toast.info('Type something first, then click AI to refine it.');
      return;
    }
    setAiBusyField(fieldPath);
    try {
      const res = await legalAi.clauseRewrite({
        documentTypeKey: doc.documentType.key,
        promptKey,
        clause: current,
        tone: 'formal',
        audience: 'both',
        jurisdiction: doc.jurisdiction ?? 'IN-*',
      });
      setDraft((d) => setAtPath(structuredClone(d), fieldPath, res.text));
      toast.success(res.cached ? 'AI suggestion (cached)' : 'AI suggestion');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'AI request failed',
      );
    } finally {
      setAiBusyField(null);
    }
  }

  if (isLoading || !doc) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-foreground/60 text-sm">Loading document…</p>
      </div>
    );
  }

  if (!bundle) {
    const key = doc.documentType?.key;
    // Freeform / AI documents have no schema bundle — they live in the
    // rich-text editor, not the structured builder. Send them there.
    if (key === 'freeform') {
      return <Navigate to={`/documents/${documentId}/draft`} replace />;
    }
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <Card className="rounded-xl p-6 max-w-lg">
          {key ? (
            <>
              <p className="text-destructive font-medium">
                Editor not available for &ldquo;{doc.documentType?.name ?? key}&rdquo;.
              </p>
              <p className="text-foreground/70 text-sm mt-2">
                This document type ({key}) doesn&apos;t have a schema
                registered in <code>libs/document-schema</code> yet. Pick a
                different document, or come back once the schema is shipped.
              </p>
            </>
          ) : (
            <>
              <p className="text-destructive font-medium">
                This document is missing its type.
              </p>
              <p className="text-foreground/70 text-sm mt-2">
                The document has no <code>documentType</code> associated with
                it — likely the type was removed after the document was
                created. Open the document from your documents list to
                continue, or delete this draft.
              </p>
            </>
          )}
          <div className="mt-4 flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/documents">Back to documents</a>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const sections = bundle.sectionOrder.map((k) => ({
    key: k,
    label: labelFor(k),
  }));

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-background px-3 py-2 sm:gap-3 sm:px-4">
        <Link
          to="/documents"
          aria-label="Back to documents"
          className="flex size-9 flex-none items-center justify-center rounded-md text-foreground/60 hover:bg-secondary/60 hover:text-foreground"
        >
          <BackIcon />
        </Link>
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          className="min-w-0 flex-1 rounded px-2 py-1 text-base font-medium bg-transparent border-0 focus:bg-foreground/5 focus:outline-none"
          placeholder="Untitled document"
        />

        {/* Mobile pane switcher */}
        <div className="flex items-center rounded-lg border border-border p-0.5 lg:hidden">
          {(['form', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMobileTab(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                mobileTab === t
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/55 hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <span className="hidden items-center gap-1.5 text-xs text-foreground/50 sm:flex">
          <span
            className={cn(
              'inline-block size-1.5 rounded-full',
              patch.isPending
                ? 'bg-amber-400'
                : patch.isError
                  ? 'bg-error'
                  : 'bg-emerald-500',
            )}
          />
          {patch.isPending ? 'Saving…' : patch.isError ? 'Save failed' : 'Saved'}
        </span>
        <Button variant="outline" size="sm" disabled className="hidden sm:inline-flex">
          Share
        </Button>
        <Button
          size="sm"
          onClick={() => {
            if (exportState.phase !== 'queued') void startExport();
          }}
          disabled={exportState.phase === 'queued'}
          className="flex-none"
        >
          {exportState.phase === 'queued' ? 'Rendering…' : 'Export PDF'}
        </Button>
      </header>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: sections + risks (desktop only) */}
        <aside className="hidden min-h-0 flex-col border-r border-border bg-background/60 lg:flex">
          <div className="flex-1 overflow-y-auto">
            <SectionsTree
              sections={sections}
              activeKey={activeSection}
              onSelect={(k) => {
                setActiveSection(k);
                formRef.current?.scrollToSection(k);
              }}
            />
          </div>
          <div className="border-t max-h-[40%] overflow-y-auto">
            <RisksPanel
              warnings={warnings}
              onJump={(fieldPath) => {
                const section = bundle.sectionOrder.find(
                  (s) => fieldPath === s || fieldPath.startsWith(`${s}.`),
                );
                if (section) {
                  setActiveSection(section);
                  formRef.current?.scrollToSection(section);
                }
              }}
            />
          </div>
        </aside>

        {/* Middle: form */}
        <main
          className={cn(
            'h-full min-h-0 bg-background',
            mobileTab === 'form' ? 'block' : 'hidden',
            'lg:block',
          )}
        >
          <BuilderForm
            ref={formRef}
            data={draft}
            formMetadata={bundle.formMetadata}
            sectionOrder={bundle.sectionOrder}
            onChange={setDraft}
            onAiAssist={onAiAssist}
            aiBusyField={aiBusyField}
          />
        </main>

        {/* Right: live preview */}
        <section
          className={cn(
            'h-full min-h-0 bg-secondary/20 lg:border-l lg:border-border',
            mobileTab === 'preview' ? 'block' : 'hidden',
            'lg:block',
          )}
        >
          <ArtboardIframe
            componentKey={doc.template?.key ? mapTemplateToComponent(doc) : 'rent-agreement.classic'}
            data={draft}
            pageSize={doc.pageSize}
            language={doc.language}
            jurisdiction={doc.jurisdiction}
            onFieldClick={(event, iframeRect) =>
              setInlineEdit({ event, iframeRect })
            }
          />
        </section>
      </div>

      {inlineEdit && (
        <InlineEditPopover
          fieldRect={inlineEdit.event.rect}
          iframeRect={inlineEdit.iframeRect}
          path={inlineEdit.event.path}
          widget={inlineEdit.event.widget}
          initialValue={getAtPath(draft, inlineEdit.event.path)}
          metadata={bundle.formMetadata[inlineEdit.event.path]}
          onCancel={() => setInlineEdit(null)}
          onCommit={(newValue) => {
            setDraft((d) =>
              setAtPath(structuredClone(d), inlineEdit.event.path, newValue),
            );
            setInlineEdit(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getAtPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, k) => {
      if (acc && typeof acc === 'object' && k in acc) {
        return (acc as Record<string, unknown>)[k];
      }
      return undefined;
    }, obj);
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const keys = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] === undefined || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return obj;
}

/**
 * DocumentTemplate stores `componentKey` separately from `key`. The API
 * returns both via `doc.template`; we need the componentKey for the
 * artboard. Until the DTO ships componentKey, fall back to a convention.
 */
function mapTemplateToComponent(doc: {
  documentType?: { key: string };
  template?: { key: string };
}): string {
  const tk = doc.template?.key ?? '';
  const dt = doc.documentType?.key ?? '';
  if (tk === 'rent-classic') return 'rent-agreement.classic';
  if (tk === 'rent-bilingual') return 'rent-agreement.bilingual';
  // Generic fallback: assume "<docType>.<templateKey>".
  return `${dt}.${tk}`;
}

function BackIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
