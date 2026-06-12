import { getBundle, type Warning } from '@org/document-schema';
import { getTemplate, type FieldClickEvent } from '@org/document-templates';
import { useDebounce, useMediaQuery } from '@org/hooks';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@org/ui';
import { cn } from '@org/utils';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { DEFAULT_LANGUAGE, LanguageSelect } from '../../../lib/languages';
import { PageSizeSelect } from '../../../lib/page-sizes';
import { ViewOriginalButton } from '../../intelligence/ViewOriginalButton';
import { CommentsDialog } from '../CommentsDialog';
import { ShareDialog } from '../ShareDialog';
import { SignaturesDialog } from '../SignaturesDialog';
import { VersionHistoryDialog } from '../VersionHistoryDialog';
import {
  useCreateDocument,
  useDocument,
  useLookupOptions,
  usePatchDocument,
} from '../queries';
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
  const { t } = useTranslation();
  const { data: doc, isLoading } = useDocument(documentId);
  const { data: lookupOptions } = useLookupOptions();
  const patch = usePatchDocument(documentId);
  const { mutate: patchMutate } = patch;
  const legalAi = useLegalAiService();
  const createDoc = useCreateDocument();
  const navigate = useNavigate();
  const confirm = useConfirm();

  // "Generate in another language" — bridge the structured data to a
  // freeform, fully-translated draft (the structured templates are English).
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [targetLang, setTargetLang] = useState(DEFAULT_LANGUAGE);
  const [langBusy, setLangBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [signaturesOpen, setSignaturesOpen] = useState(false);

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [draftTitle, setDraftTitle] = useState('');
  const [aiBusyField, setAiBusyField] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  // lg+ shows the resizable 3-pane layout; below that we show one pane at a
  // time (sections | form | preview) via the segmented switcher.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobileTab, setMobileTab] = useState<'sections' | 'form' | 'preview'>(
    'form',
  );
  const formRef = useRef<BuilderFormHandle | null>(null);
  const { state: exportState, start: startExport } = useExportPdf(documentId);

  // Auto-open the download URL once the PDF is ready.
  useEffect(() => {
    if (exportState.phase === 'ready') {
      window.open(exportState.url, '_blank', 'noopener,noreferrer');
      toast.success(
        t('builder.toast.pdfReady', 'PDF ready — opened in a new tab'),
      );
    }
    if (exportState.phase === 'failed') {
      toast.error(
        t('builder.toast.exportFailed', 'Export failed: {{error}}', {
          error: exportState.error,
        }),
      );
    }
  }, [exportState, t]);

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
      toast.info(
        t(
          'builder.toast.typeFirst',
          'Type something first, then click AI to refine it.',
        ),
      );
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
      toast.success(
        res.cached
          ? t('builder.toast.aiSuggestionCached', 'AI suggestion (cached)')
          : t('builder.toast.aiSuggestion', 'AI suggestion'),
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('builder.toast.aiFailed', 'AI request failed'),
      );
    } finally {
      setAiBusyField(null);
    }
  }

  // Generate a freeform, fully-translated copy of this structured document.
  async function generateInLanguage() {
    if (!doc) return;
    setLangModalOpen(false);
    setLangBusy(true);
    try {
      const typeName = doc.documentType?.name ?? 'legal document';
      const brief =
        `Produce a complete, formal ${typeName} in proper Indian legal drafting style, ` +
        `using the following details. Render every section in full prose (do not just list the data).\n\n` +
        `Details (JSON):\n${JSON.stringify(draft, null, 2)}`;
      const gen = await legalAi.generate({
        brief,
        language: targetLang,
        documentTypeKey: doc.documentType?.key,
      });
      const newDoc = await createDoc.mutateAsync({
        title: `${draftTitle || typeName} (${targetLang})`,
        documentTypeKey: 'freeform',
        templateKey: 'freeform',
        data: { html: gen.html, values: {}, templateId: 'freeform' },
      });
      toast.success(
        t('builder.toast.draftCreated', 'Draft created in {{lang}}', {
          lang: targetLang,
        }),
        { description: gen.disclaimer },
      );
      navigate(`/documents/${newDoc.id}/draft`);
    } catch {
      toast.error(
        t(
          'builder.toast.generateFailed',
          'Could not generate in that language. Check your AI provider / quota.',
        ),
      );
    } finally {
      setLangBusy(false);
    }
  }

  // One-way "eject": render the structured template to static HTML and create a
  // free-form copy the user can edit without the guided form's constraints.
  async function detachToFreeform() {
    if (!doc) return;
    const ok = await confirm({
      title: t('builder.detach.title', 'Edit as a free-form document?'),
      description: t(
        'builder.detach.desc',
        'This creates an editable copy in the rich-text editor with the current content baked in. It is no longer tied to the guided form, risk checks, or auto-recalculation — and you cannot convert it back.',
      ),
      confirmLabel: t('builder.detach.confirm', 'Create editable copy'),
    });
    if (!ok) return;
    try {
      const componentKey = resolveComponentKey(doc);
      const Template = getTemplate(componentKey);
      if (!Template) {
        toast.error(t('builder.detach.noTemplate', 'No renderer for this template.'));
        return;
      }
      const markup = renderToStaticMarkup(
        createElement(Template, {
          data: draft,
          pageSize: doc.pageSize,
        } as never),
      );
      // The Paginator renders a hidden "mirror" div holding the full, unpaginated
      // content in order — use that as the clean body, drop page chrome/styles.
      const parsed = new DOMParser().parseFromString(markup, 'text/html');
      const mirror = parsed.querySelector('[aria-hidden]');
      const html = (mirror?.innerHTML ?? parsed.body.innerHTML).trim();
      const newDoc = await createDoc.mutateAsync({
        title: `${draftTitle || doc.title} (editable copy)`,
        documentTypeKey: 'freeform',
        templateKey: 'freeform',
        data: { html, values: {}, fields: [], templateId: 'freeform' },
      });
      toast.success(
        t('builder.detach.done', 'Editable free-form copy created'),
      );
      navigate(`/documents/${newDoc.id}/draft`);
    } catch {
      toast.error(
        t('builder.detach.failed', 'Could not create the free-form copy.'),
      );
    }
  }

  if (isLoading || !doc) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-foreground/60 text-sm">
          {t('builder.loading', 'Loading document…')}
        </p>
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
              <p className="text-error font-medium">
                {t(
                  'builder.noSchema.title',
                  'Editor not available for “{{name}}”.',
                  {
                    name: doc.documentType?.name ?? key,
                  },
                )}
              </p>
              <p className="text-foreground/70 text-sm mt-2">
                {t(
                  'builder.noSchema.body',
                  "This document type ({{key}}) doesn't have a schema registered in libs/document-schema yet. Pick a different document, or come back once the schema is shipped.",
                  { key },
                )}
              </p>
            </>
          ) : (
            <>
              <p className="text-error font-medium">
                {t(
                  'builder.noType.title',
                  'This document is missing its type.',
                )}
              </p>
              <p className="text-foreground/70 text-sm mt-2">
                {t(
                  'builder.noType.body',
                  'The document has no documentType associated with it — likely the type was removed after the document was created. Open the document from your documents list to continue, or delete this draft.',
                )}
              </p>
            </>
          )}
          <div className="mt-4 flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/documents">
                {t('builder.backToDocuments', 'Back to documents')}
              </a>
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

  // Each pane defined once, then placed into either the desktop resizable
  // layout or the mobile single-pane switcher (one mount each — so the single
  // artboard iframe is never duplicated).
  const sectionsPane = (
    <aside className="flex h-full w-full flex-col bg-background/60">
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
  );

  const formPane = (
    <main className="h-full min-h-0 bg-background">
      <BuilderForm
        ref={formRef}
        data={draft}
        formMetadata={bundle.formMetadata}
        sectionOrder={bundle.sectionOrder}
        lookupOptions={lookupOptions}
        onChange={setDraft}
        onAiAssist={onAiAssist}
        aiBusyField={aiBusyField}
      />
    </main>
  );

  const previewPane = (
    <section className="h-full min-h-0 bg-secondary/20">
      <ArtboardIframe
        componentKey={resolveComponentKey(doc)}
        data={draft}
        pageSize={doc.pageSize}
        language={doc.language}
        jurisdiction={doc.jurisdiction}
        onFieldClick={(event, iframeRect) =>
          setInlineEdit({ event, iframeRect })
        }
      />
    </section>
  );

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar — two rows: identity + primary (row 1), grouped actions (row 2) */}
      <header className="flex-none border-b border-border bg-background">
        {/* Row 1 — identity + primary */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 sm:gap-3 sm:px-4">
          <Link
            to="/documents"
            aria-label={t('builder.backToDocuments', 'Back to documents')}
            className="flex size-9 flex-none items-center justify-center rounded-md text-foreground/60 hover:bg-secondary/60 hover:text-foreground"
          >
            <BackIcon />
          </Link>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="min-w-0 flex-1 rounded px-2 py-1 text-base font-medium bg-transparent border-0 focus:bg-foreground/5 focus:outline-none"
            placeholder={t('builder.untitled', 'Untitled document')}
          />

          <span className="flex flex-none items-center gap-1.5 text-xs text-foreground/50">
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
            <span className="hidden sm:inline">
              {patch.isPending
                ? t('builder.status.saving', 'Saving…')
                : patch.isError
                  ? t('builder.status.saveFailed', 'Save failed')
                  : t('builder.status.saved', 'Saved')}
            </span>
          </span>
          <Button
            size="sm"
            onClick={() => {
              if (exportState.phase !== 'queued') void startExport();
            }}
            disabled={exportState.phase === 'queued'}
            className="flex-none gap-1.5"
          >
            {exportState.phase === 'queued'
              ? t('builder.rendering', 'Rendering…')
              : t('builder.exportPdf', 'Export PDF')}
          </Button>
        </div>

        {/* Row 2 — grouped secondary actions (scrolls on small screens) */}
        <div className="flex items-center gap-1 overflow-x-auto px-2 pb-1.5 text-foreground/75 sm:px-3">
          <Button
            variant="ghost"
            size="sm"
            isLoading={langBusy}
            onClick={() => setLangModalOpen(true)}
            className="h-7 flex-none gap-1.5 px-2 text-xs"
            title={t(
              'builder.languageTooltip',
              'Generate this document in another language',
            )}
          >
            <GlobeIcon />
            {t('builder.language', 'Language')}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={detachToFreeform}
            className="h-7 flex-none gap-1.5 px-2 text-xs"
            title={t(
              'builder.detachTooltip',
              'Create a free-form editable copy (one-way — leaves the guided form)',
            )}
          >
            {t('builder.detach', 'Edit as free-form')}
          </Button>

          {(() => {
            const sourceId = (
              doc.data as { sourceDocumentId?: string } | undefined
            )?.sourceDocumentId;
            return sourceId ? (
              <ViewOriginalButton
                sourceId={sourceId}
                size="sm"
                variant="ghost"
              />
            ) : null;
          })()}

          <span aria-hidden className="mx-1 h-5 w-px flex-none bg-border/70" />

          <div
            role="group"
            aria-label={t('editor.group.collaborate', 'Collaborate')}
            className="flex items-center gap-0.5"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="h-7 flex-none gap-1.5 px-2 text-xs"
            >
              {t('builder.share', 'Share')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCommentsOpen(true)}
              className="h-7 flex-none gap-1.5 px-2 text-xs"
            >
              {t('builder.comments', 'Comments')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSignaturesOpen(true)}
              className="h-7 flex-none gap-1.5 px-2 text-xs"
            >
              {t('builder.signatures', 'Signatures')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
              className="h-7 flex-none gap-1.5 px-2 text-xs"
            >
              {t('builder.history', 'History')}
            </Button>
          </div>

          <div className="ml-auto flex flex-none items-center pl-2">
            <PageSizeSelect
              value={doc.pageSize}
              onChange={(size) => patchMutate({ pageSize: size })}
            />
          </div>
        </div>
      </header>

      {/* Mobile pane switcher */}
      {!isDesktop && (
        <div className="flex flex-none items-center gap-1 border-b border-border bg-background p-1">
          {(['sections', 'form', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMobileTab(tab)}
              className={cn(
                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                mobileTab === tab
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/55 hover:text-foreground',
              )}
            >
              {tab === 'sections'
                ? t('builder.tab.sections', 'Sections')
                : tab === 'form'
                  ? t('builder.tab.form', 'Form')
                  : t('builder.tab.preview', 'Preview')}
            </button>
          ))}
        </div>
      )}

      {isDesktop ? (
        /* ── Desktop: resizable 3-pane layout (matches the freeform editor) ── */
        <Group orientation="horizontal" className="min-h-0 flex-1">
          <Panel
            id="sections"
            defaultSize="20%"
            minSize="14%"
            maxSize="32%"
            className="min-w-0"
          >
            <div className="h-full border-r border-border">{sectionsPane}</div>
          </Panel>

          <Separator className="relative flex w-1.5 items-center justify-center bg-border/50 transition-colors hover:bg-primary/30 active:bg-primary/50">
            <div className="h-8 w-0.5 rounded-full bg-foreground/20" />
          </Separator>

          <Panel id="form" defaultSize="40%" minSize="24%" className="min-w-0">
            {formPane}
          </Panel>

          <Separator className="relative flex w-1.5 items-center justify-center bg-border/50 transition-colors hover:bg-primary/30 active:bg-primary/50">
            <div className="h-8 w-0.5 rounded-full bg-foreground/20" />
          </Separator>

          <Panel
            id="preview"
            defaultSize="40%"
            minSize="22%"
            className="min-w-0 border-l border-border"
          >
            {previewPane}
          </Panel>
        </Group>
      ) : (
        /* ── Mobile / tablet: one pane at a time ── */
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'min-h-0 flex-1',
              mobileTab === 'sections' ? 'block' : 'hidden',
            )}
          >
            {sectionsPane}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1',
              mobileTab === 'form' ? 'block' : 'hidden',
            )}
          >
            {formPane}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1',
              mobileTab === 'preview' ? 'block' : 'hidden',
            )}
          >
            {previewPane}
          </div>
        </div>
      )}

      <ShareDialog
        documentId={documentId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <VersionHistoryDialog
        documentId={documentId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <CommentsDialog
        documentId={documentId}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
      <SignaturesDialog
        documentId={documentId}
        open={signaturesOpen}
        onOpenChange={setSignaturesOpen}
        docTypeKey={doc.documentType?.key}
      />

      {/* Generate-in-language modal */}
      <Dialog open={langModalOpen} onOpenChange={setLangModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('builder.langModal.title', 'Generate in another language')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'builder.langModal.description',
                'AI will draft a full, editable copy of this document in the chosen language using your entered details. It opens as a freeform draft you can refine and export.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            <Label htmlFor="builder-lang">
              {t('builder.language', 'Language')}
            </Label>
            <LanguageSelect
              id="builder-lang"
              value={targetLang}
              onChange={setTargetLang}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLangModalOpen(false)}
            >
              {t('builder.cancel', 'Cancel')}
            </Button>
            <Button size="sm" isLoading={langBusy} onClick={generateInLanguage}>
              {t('builder.langModal.generate', 'Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
  return path.split('.').reduce<unknown>((acc, k) => {
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
 * Resolve the artboard renderer key for a document. The canonical source is
 * `doc.template.componentKey` (shipped on the detail response via `getById`'s
 * full template include — same field the export/render-payload path uses).
 * The legacy template-key convention below is only a defensive fallback for
 * responses that omit it (e.g. a stale cache or the list shape).
 */
function resolveComponentKey(doc: {
  documentType?: { key: string };
  template?: { key: string; componentKey?: string };
}): string {
  return doc.template?.componentKey ?? mapTemplateToComponent(doc);
}

function mapTemplateToComponent(doc: {
  documentType?: { key: string };
  template?: { key: string };
}): string {
  const tk = doc.template?.key ?? '';
  const dt = doc.documentType?.key ?? '';
  if (tk === 'rent-classic') return 'rent-agreement.classic';
  if (tk === 'rent-bilingual') return 'rent-agreement.bilingual';
  if (tk === 'rti-default-en' || tk === 'rti-default-hi') return 'rti.default';
  if (tk === 'notice-formal') return 'legal-notice.formal';
  if (!tk) return 'rent-agreement.classic';
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

function GlobeIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
