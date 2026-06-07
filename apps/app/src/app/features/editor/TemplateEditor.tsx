import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  PageBreakExtension,
  PlaceholderHighlightExtension,
  PLACEHOLDER_HIGHLIGHT_META,
  extractPlaceholderKeys,
  renderTemplateHtml,
  TransliterationExtension,
  type TransliterationState,
  SuggestionPopover,
} from '@org/ui';
import { TransliterationProvider, useTransliteration } from '@org/transliteration';
import { cn } from '@org/utils';
import { toast } from 'sonner';

import { EditorToolbar } from './components/EditorToolbar';
import { PlaceholderForm, type PlaceholderFormHandle } from './components/PlaceholderForm';
import { TemplateGallery } from './components/TemplateGallery';
import { PaginatedPreview } from './components/PaginatedPreview';
import { PageNavigator } from './components/PageNavigator';
import { TEMPLATES, getTemplateById } from './templates/registry';
import type { DocumentTemplate, PlaceholderDef } from './templates/types';
import { downloadWordDoc } from './export-word';

const DEFAULT_TEMPLATE_ID = 'rent-agreement';
const DRAFT_KEY = 'legaldraft:editor:draft:v1';

/** Snapshot of editor state handed to persistence callbacks. */
export type EditorDraftState = {
  templateId: string;
  title: string;
  html: string;
  values: Record<string, string>;
};

/**
 * Where the editor reads/writes its working draft.
 *  - `local`: localStorage (the `/editor` scratchpad — survives refresh, no login coupling).
 *  - `bound`: a backend Document (the `/documents/:id/draft` route) — autosaves via `onSave`.
 */
export type EditorPersistence =
  | { mode: 'local' }
  | {
      mode: 'bound';
      initial: {
        templateId?: string;
        title?: string;
        html: string;
        values: Record<string, string>;
      };
      onSave: (s: EditorDraftState) => void;
      savedAt?: number | null;
      saving?: boolean;
    };

export interface TemplateEditorProps {
  persistence?: EditorPersistence;
  /** When set, the top bar shows a back link to this route. */
  backHref?: string;
  /** Local mode only — renders a "Save to my documents" action when provided. */
  onSaveToCloud?: (s: EditorDraftState) => void;
  savingToCloud?: boolean;
  /** When provided, a "Draft with AI" action prompts for a brief and replaces the document. */
  onAiGenerate?: (brief: string) => Promise<{ html: string; disclaimer?: string }>;
  /** When provided, a "Revise with AI" action applies an instruction to the current HTML. */
  onAiRevise?: (instruction: string, html: string) => Promise<{ html: string }>;
  /** When provided, the PDF button uses this (the reliable backend export) instead of window.print. */
  onExportPdf?: () => void;
  exportingPdf?: boolean;
}

function TemplateEditorInner({
  persistence,
  backHref,
  onSaveToCloud,
  savingToCloud,
  onAiGenerate,
  onAiRevise,
  onExportPdf,
  exportingPdf,
}: {
  persistence: EditorPersistence;
  backHref?: string;
  onSaveToCloud?: (s: EditorDraftState) => void;
  savingToCloud?: boolean;
  onAiGenerate?: (brief: string) => Promise<{ html: string; disclaimer?: string }>;
  onAiRevise?: (instruction: string, html: string) => Promise<{ html: string }>;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
}) {
  const { enabled, language } = useTransliteration();
  const bound = persistence.mode === 'bound';
  // Recover any in-progress local draft (local mode only).
  const restored = useMemo(() => (bound ? null : loadDraft()), [bound]);
  // Initial seed is computed once — useState ignores later changes to `init`.
  const init = useMemo<{
    template: DocumentTemplate;
    values: Record<string, string>;
    html: string;
    savedAt: number | null;
  }>(() => {
    if (persistence.mode === 'bound') {
      const t =
        getTemplateById(persistence.initial.templateId ?? '') ??
        synthesizeTemplate(persistence.initial);
      return {
        template: t,
        values: persistence.initial.values,
        html: persistence.initial.html,
        savedAt: persistence.savedAt ?? null,
      };
    }
    const t =
      getTemplateById(restored?.templateId ?? DEFAULT_TEMPLATE_ID) ??
      TEMPLATES[0];
    return {
      template: t,
      values: restored?.values ?? seedValues(t.placeholders),
      html: restored?.html ?? t.html,
      savedAt: restored?.savedAt ?? null,
    };
  }, []);
  const [template, setTemplate] = useState<DocumentTemplate>(init.template);
  const [values, setValues] = useState<Record<string, string>>(init.values);
  const [html, setHtml] = useState<string>(init.html);
  const [savedAt, setSavedAt] = useState<number | null>(init.savedAt);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'fields' | 'pages'>('fields');
  const [showPreview, setShowPreview] = useState(true);
  const [activePage, setActivePage] = useState(0);

  const formRef = useRef<PlaceholderFormHandle>(null);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const handleTokenClick = useCallback((key: string) => {
    setSidebarTab('fields');
    requestAnimationFrame(() => formRef.current?.focusField(key));
  }, []);

  // --- Transliteration (type in English, get Indic script) ---
  const [translitState, setTranslitState] =
    useState<TransliterationState | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

  const handleSuggestions = useCallback((state: TransliterationState) => {
    setTranslitState({ ...state });
    const container = editorScrollRef.current;
    const sel = window.getSelection();
    if (container && sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      setPopoverPosition({
        top: rect.bottom - cRect.top + container.scrollTop + 4,
        left: rect.left - cRect.left + container.scrollLeft,
      });
    }
  }, []);

  const handleDismissSuggestions = useCallback(() => setTranslitState(null), []);

  const editor: Editor | null = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing or pick a template...',
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Highlight.configure({ multicolor: true }),
      PageBreakExtension,
      PlaceholderHighlightExtension.configure({
        values: {},
        onTokenClick: handleTokenClick,
      }),
      TransliterationExtension.configure({
        language,
        enabled,
        debounceMs: 150,
        onSuggestions: handleSuggestions,
        onDismiss: handleDismissSuggestions,
      }),
    ],
    content: init.html,
    onUpdate: ({ editor: ed }) => {
      setHtml(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-full',
      },
    },
  });

  // Keep extension storage in sync so highlight colors flip when values change.
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === 'placeholderHighlight',
    );
    if (ext) {
      (ext.storage as { values: Record<string, string> }).values = values;
      editor.view.dispatch(
        editor.state.tr.setMeta(PLACEHOLDER_HIGHLIGHT_META, true),
      );
    }
  }, [editor, values]);

  // Keep the transliteration extension's live state in sync with the toolbar.
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === 'transliteration',
    );
    if (ext) {
      const state = ext.storage.state as TransliterationState;
      state.enabled = enabled;
      state.language = language;
    }
    if (!enabled) setTranslitState(null);
  }, [editor, enabled, language]);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      if (!editor) return;
      const ext = editor.extensionManager.extensions.find(
        (e) => e.name === 'transliteration',
      );
      if (ext) {
        const state = ext.storage.state as TransliterationState;
        editor
          .chain()
          .focus()
          .deleteRange({
            from: state.bufferStart,
            to: state.bufferStart + state.buffer.length,
          })
          .insertContentAt(state.bufferStart, suggestion)
          .run();
        state.buffer = '';
        state.bufferStart = 0;
        state.suggestions = [];
        state.showSuggestions = false;
        state.selectedIndex = 0;
      }
      setTranslitState(null);
    },
    [editor],
  );

  // One-time notice if we recovered a draft from a previous visit.
  useEffect(() => {
    if (restored) {
      toast.message('Restored your last draft', {
        description: 'Your in-progress document was recovered from this browser.',
      });
    }
  }, []);

  // Stable ref to the latest persistence config so the autosave effect depends
  // ONLY on content — avoids a re-save loop when the parent re-renders.
  const persistenceRef = useRef(persistence);
  persistenceRef.current = persistence;
  const skipFirstSave = useRef(true);

  // Debounced autosave: localStorage (local) or the backend `onSave` (bound).
  useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    const p = persistenceRef.current;
    const t = setTimeout(() => {
      if (p.mode === 'bound') {
        p.onSave({ templateId: template.id, title: template.name, html, values });
      } else {
        const now = Date.now();
        saveDraft({ templateId: template.id, html, values, savedAt: now });
        setSavedAt(now);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [template.id, template.name, html, values]);

  // Bound mode: reflect the parent-reported save time in the status bar.
  const boundSavedAt =
    persistence.mode === 'bound' ? persistence.savedAt ?? null : null;
  useEffect(() => {
    if (persistence.mode === 'bound') setSavedAt(boundSavedAt);
  }, [persistence.mode, boundSavedAt]);

  const isSaving =
    persistence.mode === 'bound' ? !!persistence.saving : !!savingToCloud;

  const loadTemplate = useCallback(
    (t: DocumentTemplate) => {
      setTemplate(t);
      const seeded = seedValues(t.placeholders);
      setValues(seeded);
      setHtml(t.html);
      editor?.commands.setContent(t.html);
      setActivePage(0);
      toast.success(`Loaded template: ${t.name}`);
    },
    [editor],
  );

  const handleGenerate = useCallback(async () => {
    if (!editor) return;
    // Fallback when no AI provider is wired: re-seed from the template.
    toast.message('Reloading template...');
    await new Promise((r) => setTimeout(r, 400));
    editor.commands.setContent(template.html);
    setHtml(template.html);
    setValues(seedValues(template.placeholders));
    setActivePage(0);
    toast.success('Template reloaded');
  }, [editor, template]);

  const [aiBusy, setAiBusy] = useState(false);

  const handleAiGenerate = useCallback(async () => {
    if (!editor || !onAiGenerate) return;
    const brief = window.prompt(
      'Describe the document you want to draft (e.g. "Rent agreement, landlord Ramesh, tenant Priya, 2BHK Pune, ₹25,000/mo, 11-month term").',
    );
    if (!brief?.trim()) return;
    setAiBusy(true);
    toast.message('Drafting with AI…');
    try {
      const { html: out, disclaimer } = await onAiGenerate(brief.trim());
      editor.commands.setContent(out);
      setHtml(out);
      setValues({});
      setActivePage(0);
      toast.success(
        'Draft generated',
        disclaimer ? { description: disclaimer } : undefined,
      );
    } catch {
      toast.error('AI generation failed. Check your AI provider / quota.');
    } finally {
      setAiBusy(false);
    }
  }, [editor, onAiGenerate]);

  const handleAiRevise = useCallback(async () => {
    if (!editor || !onAiRevise) return;
    const instruction = window.prompt(
      'How should the AI revise this document? (e.g. "make the deposit 2 months", "add a no-pets clause", "make it more tenant-friendly")',
    );
    if (!instruction?.trim()) return;
    setAiBusy(true);
    toast.message('Revising with AI…');
    try {
      const { html: out } = await onAiRevise(instruction.trim(), html);
      editor.commands.setContent(out);
      setHtml(out);
      setActivePage(0);
      toast.success('Document revised', {
        description: 'Press Ctrl/Cmd+Z to undo if needed.',
      });
    } catch {
      toast.error('AI revision failed. Check your AI provider / quota.');
    } finally {
      setAiBusy(false);
    }
  }, [editor, onAiRevise, html]);

  const handleInsertPlaceholder = useCallback(() => {
    if (!editor) return;
    const key = window.prompt('Field key (letters / numbers / underscore):');
    if (!key) return;
    const cleaned = key.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleaned) {
      toast.error('Invalid field key');
      return;
    }
    editor.chain().focus().insertContent(`{{${cleaned}}}`).run();
  }, [editor]);

  const handleInsertPageBreak = useCallback(() => {
    editor?.chain().focus().insertPageBreak().run();
  }, [editor]);

  const handleAddPage = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus('end')
      .insertPageBreak()
      .insertContent('<p></p>')
      .run();
  }, [editor]);

  const handleJumpToPage = useCallback(
    (pageIndex: number) => {
      if (!editor) return;
      const positions = findPageBreakPositions(editor);
      // Page i starts after break i-1 (or at doc start for page 0).
      let targetPos = 0;
      if (pageIndex > 0) {
        const breakPos = positions[pageIndex - 1];
        if (breakPos == null) return;
        targetPos = breakPos + 2; // place caret after the page-break node
      }
      const clamped = Math.min(
        Math.max(targetPos, 1),
        editor.state.doc.content.size - 1,
      );
      editor.chain().focus().setTextSelection(clamped).scrollIntoView().run();
      setActivePage(pageIndex);
    },
    [editor],
  );

  const handleRemovePage = useCallback(
    (pageIndex: number) => {
      if (!editor) return;
      const positions = findPageBreakPositions(editor);
      if (positions.length === 0) return;
      // Page 0 has no preceding break; remove the break AFTER it instead.
      const breakIdx = pageIndex === 0 ? 0 : pageIndex - 1;
      const breakPos = positions[breakIdx];
      if (breakPos == null) return;
      editor
        .chain()
        .focus()
        .setNodeSelection(breakPos)
        .deleteSelection()
        .run();
      setActivePage((p) => Math.max(0, Math.min(p, positions.length - 1)));
    },
    [editor],
  );

  // Track active page based on cursor position.
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const positions = findPageBreakPositions(editor);
      const cursor = editor.state.selection.from;
      let page = 0;
      for (const p of positions) {
        if (cursor > p) page++;
        else break;
      }
      setActivePage(page);
    };
    editor.on('selectionUpdate', update);
    editor.on('update', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('update', update);
    };
  }, [editor]);

  const handleValueChange = useCallback((key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const discoveredKeys = useMemo(() => extractPlaceholderKeys(html), [html]);

  const completionStats = useMemo(() => {
    const total = discoveredKeys.length;
    if (total === 0) return { total: 0, filled: 0, pct: 100 };
    const filled = discoveredKeys.filter((k) => values[k]?.trim()).length;
    return { total, filled, pct: Math.round((filled / total) * 100) };
  }, [discoveredKeys, values]);

  const handleCopy = useCallback(async () => {
    const rendered = renderTemplateHtml(html, values);
    try {
      await navigator.clipboard.writeText(stripHtmlToText(rendered));
      toast.success('Copied document text to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }, [html, values]);

  const handleExportWord = useCallback(() => {
    downloadWordDoc({
      filename: template.name,
      title: template.name,
      html,
      values,
    });
    toast.success('Word document downloaded');
  }, [template.name, html, values]);

  const handlePrint = useCallback(() => {
    const rendered = renderTemplateHtml(html, values);
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) {
      toast.error('Could not open print window');
      return;
    }
    const scriptOpen = '<' + 'script>';
    const scriptClose = '<' + '/script>';
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeAttr(template.name)}</title><style>${PRINT_CSS}</style></head><body>${rendered}${scriptOpen}window.onload=()=>setTimeout(()=>window.print(),200)${scriptClose}</body></html>`,
    );
    w.document.close();
  }, [html, values, template]);

  // Sidebar fields panel knows known + unknown keys.
  const fieldsFromTemplate: PlaceholderDef[] = useMemo(() => {
    const known = template.placeholders;
    const knownKeys = new Set(known.map((p) => p.key));
    // Only show template fields that still exist in the doc.
    const stillUsed = known.filter((p) => discoveredKeys.includes(p.key));
    // Preserve original metadata ordering for those.
    return stillUsed.length > 0
      ? stillUsed
      : known.filter((p) => knownKeys.has(p.key));
  }, [template, discoveredKeys]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-secondary/10">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {backHref && (
            <Link
              to={backHref}
              aria-label="Back"
              className="flex size-8 flex-none items-center justify-center rounded text-foreground/60 hover:bg-secondary/60 hover:text-foreground"
            >
              <BackIcon />
            </Link>
          )}
          <div className="flex size-8 flex-none items-center justify-center rounded bg-secondary/60 text-lg">
            {template.icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{template.name}</div>
            <div className="truncate text-[11px] text-foreground/55">
              {template.category} · {completionStats.filled}/
              {completionStats.total} fields filled
              {enabled && ' · Transliteration on'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGalleryOpen(true)}
            className="gap-1.5 text-xs"
          >
            <GalleryIcon />
            Templates
          </Button>
          {persistence.mode === 'local' && onSaveToCloud && (
            <Button
              variant="outline"
              size="sm"
              isLoading={isSaving}
              onClick={() =>
                onSaveToCloud({
                  templateId: template.id,
                  title: template.name,
                  html,
                  values,
                })
              }
              className="gap-1.5 text-xs"
            >
              <CloudIcon />
              Save to my documents
            </Button>
          )}
          {onAiGenerate ? (
            <Button
              variant="outline"
              size="sm"
              isLoading={aiBusy}
              onClick={handleAiGenerate}
              className="gap-1.5 text-xs"
            >
              <SparklesIcon />
              Draft with AI
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              className="gap-1.5 text-xs"
            >
              <SparklesIcon />
              Reload template
            </Button>
          )}
          {onAiRevise && (
            <Button
              variant="outline"
              size="sm"
              isLoading={aiBusy}
              onClick={handleAiRevise}
              className="gap-1.5 text-xs"
            >
              <SparklesIcon />
              Revise with AI
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5 text-xs"
          >
            <CopyIcon />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportWord}
            className="gap-1.5 text-xs"
          >
            <DownloadIcon />
            Word
          </Button>
          {onExportPdf ? (
            <Button
              size="sm"
              isLoading={exportingPdf}
              onClick={onExportPdf}
              className="gap-1.5 text-xs"
            >
              <PrintIcon />
              Export PDF
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs"
            >
              <PrintIcon />
              Print
            </Button>
          )}
          <Tooltip content={showPreview ? 'Hide preview' : 'Show preview'}>
            <Button
              variant={showPreview ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowPreview((s) => !s)}
              className="size-8 p-0"
            >
              <SplitIcon />
            </Button>
          </Tooltip>
        </div>
      </div>

      <Group orientation="horizontal" className="flex-1">
        {/* Left sidebar */}
        <Panel
          id="sidebar"
          defaultSize="22%"
          minSize="15%"
          maxSize="36%"
          className="min-w-0"
        >
        <aside className="flex h-full w-full flex-col border-r border-border bg-background">
          <Tabs
            value={sidebarTab}
            onValueChange={(v) => setSidebarTab(v as 'fields' | 'pages')}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="border-b border-border px-3 py-2">
              <TabsList className="w-full">
                <TabsTrigger value="fields" className="flex-1 text-xs">
                  Fields
                  {completionStats.total > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                      {completionStats.filled}/{completionStats.total}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="pages" className="flex-1 text-xs">
                  Pages
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="fields" className="!mt-0">
                {completionStats.total > 0 && (
                  <div className="border-b border-border bg-secondary/15 px-4 py-2">
                    <div className="flex items-center justify-between text-[11px] text-foreground/60">
                      <span>Completion</span>
                      <span>{completionStats.pct}%</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary/40">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${completionStats.pct}%` }}
                      />
                    </div>
                  </div>
                )}
                <PlaceholderForm
                  ref={formRef}
                  fields={fieldsFromTemplate}
                  values={values}
                  onChange={handleValueChange}
                  unknownKeys={discoveredKeys}
                />
              </TabsContent>

              <TabsContent value="pages" className="!mt-0">
                <PageNavigator
                  html={html}
                  activePage={activePage}
                  onJumpToPage={handleJumpToPage}
                  onAddPage={handleAddPage}
                  onRemovePage={handleRemovePage}
                />
              </TabsContent>
            </div>
          </Tabs>
        </aside>
        </Panel>

        <Separator className="relative flex w-1.5 items-center justify-center bg-border/50 transition-colors hover:bg-primary/30 active:bg-primary/50">
          <div className="h-8 w-0.5 rounded-full bg-foreground/20" />
        </Separator>

        {/* Editor pane */}
        <Panel
          id="editor"
          defaultSize={showPreview ? '40%' : '78%'}
          minSize="28%"
          className="min-w-0"
        >
        <section className="flex h-full flex-col overflow-hidden bg-background">
          {editor && (
            <EditorToolbar
              editor={editor}
              onInsertPlaceholder={handleInsertPlaceholder}
              onInsertPageBreak={handleInsertPageBreak}
            />
          )}
          <div
            ref={editorScrollRef}
            className="relative flex-1 overflow-y-auto bg-background"
          >
            <div className="mx-auto max-w-3xl px-8 py-6">
              <EditorContent editor={editor} />
            </div>
            {translitState && (
              <SuggestionPopover
                suggestions={translitState.suggestions}
                selectedIndex={translitState.selectedIndex}
                onSelect={handleSuggestionSelect}
                visible={translitState.showSuggestions}
                position={popoverPosition}
              />
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-background px-3 py-1 text-[11px] text-foreground/55">
            <span>
              {editor?.getText().length ?? 0} chars ·{' '}
              {editor
                ? editor.getText().split(/\s+/).filter(Boolean).length
                : 0}{' '}
              words · Page {activePage + 1}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-block size-1.5 rounded-full',
                  savedAt ? 'bg-emerald-500' : 'bg-amber-400',
                )}
              />
              {isSaving
                ? 'Saving…'
                : savedAt
                ? `${bound ? 'Saved to cloud' : 'Saved'} ${formatTime(savedAt)}`
                : bound
                ? 'Saving…'
                : 'Not saved yet'}
            </span>
          </div>
        </section>
        </Panel>

        {/* Preview pane */}
        {showPreview && (
          <>
            <Separator className="relative flex w-1.5 items-center justify-center bg-border/50 transition-colors hover:bg-primary/30 active:bg-primary/50">
              <div className="h-8 w-0.5 rounded-full bg-foreground/20" />
            </Separator>
            <Panel id="preview" defaultSize="38%" minSize="20%" className="min-w-0">
              <PaginatedPreview html={html} values={values} className="h-full" />
            </Panel>
          </>
        )}
      </Group>

      <TemplateGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={loadTemplate}
        activeId={template.id}
      />
    </div>
  );
}

export function TemplateEditor({
  persistence = { mode: 'local' },
  backHref,
  onSaveToCloud,
  savingToCloud,
  onAiGenerate,
  onAiRevise,
  onExportPdf,
  exportingPdf,
}: TemplateEditorProps = {}) {
  return (
    <TransliterationProvider defaultLanguage="hi" defaultEnabled={false}>
      <TemplateEditorInner
        persistence={persistence}
        backHref={backHref}
        onSaveToCloud={onSaveToCloud}
        savingToCloud={savingToCloud}
        onAiGenerate={onAiGenerate}
        onAiRevise={onAiRevise}
        onExportPdf={onExportPdf}
        exportingPdf={exportingPdf}
      />
    </TransliterationProvider>
  );
}

// --- helpers ---

/** A backend doc (or AI draft) may not map to a gallery template — wrap its
 * HTML in a minimal template so the editor can render it. Discovered {{keys}}
 * still surface in the Fields panel as custom fields. */
function synthesizeTemplate(init: {
  templateId?: string;
  title?: string;
  html: string;
}): DocumentTemplate {
  return {
    id: init.templateId ?? 'freeform',
    name: init.title ?? 'Document',
    description: '',
    category: 'Document',
    icon: '📄',
    html: init.html,
    placeholders: [],
  };
}

type DraftData = {
  templateId: string;
  html: string;
  values: Record<string, string>;
  savedAt: number;
};

function loadDraft(): DraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftData;
    if (!parsed || typeof parsed.html !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(d: DraftData): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* localStorage unavailable or over quota — autosave is best-effort */
  }
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function seedValues(defs: PlaceholderDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) {
    if (d.default != null) out[d.key] = d.default;
  }
  return out;
}

function findPageBreakPositions(editor: Editor): number[] {
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'pageBreak') positions.push(pos);
  });
  return positions;
}

function stripHtmlToText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.innerText;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const PRINT_CSS = `
  @page { size: A4; margin: 20mm 18mm 18mm 18mm; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 18pt; font-weight: 700; margin: 0 0 0.5rem; }
  h2 { font-size: 13pt; font-weight: 600; margin: 1rem 0 0.4rem; }
  h3 { font-size: 11.5pt; font-weight: 600; margin: 0.6rem 0 0.3rem; }
  p { margin: 0 0 0.5rem; }
  ul, ol { margin: 0 0 0.5rem; padding-left: 1.4rem; }
  li { margin-bottom: 0.15rem; }
  mark { background: #fef08a; padding: 0 0.15rem; }
  [data-page-break] { page-break-after: always; height: 0; visibility: hidden; }
  .placeholder-token--empty { color: #92400e; background: #fef3c7; padding: 0 0.25rem; border-radius: 0.2rem; }
`;

// --- header icons ---

function GalleryIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9.9-2.7z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

function CloudIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  );
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
