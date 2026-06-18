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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Textarea,
  PageBreakExtension,
  PlaceholderHighlightExtension,
  PLACEHOLDER_HIGHLIGHT_META,
  extractPlaceholderKeys,
  renderTemplateHtml,
  TransliterationExtension,
  type TransliterationState,
  SuggestionPopover,
} from '@org/ui';
import {
  TransliterationProvider,
  useTransliteration,
} from '@org/transliteration';
import { cn } from '@org/utils';
import { useMediaQuery } from '@org/hooks';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { diffText, isUnchanged, type DiffSegment } from './revision-diff';

import { EditorSideMenu, type RailItem } from './EditorActivityRail';
import { LayoutPresetGroup } from './LayoutPresetGroup';
import {
  CitationsIcon,
  CommentsIcon,
  FieldsIcon,
  HistoryIcon as RailHistoryIcon,
  InsightsIcon,
  PagesIcon,
  ShareIcon as RailShareIcon,
  SignaturesIcon,
  UsageIcon,
} from './rail-icons';
import { CitationHealth } from '../legal-ai/CitationHealth';
import { DocumentInsights } from '../intelligence/DocumentInsights';
import { AiUsageSummary } from '../admin/ai-usage/AiUsageSummary';
import { CommentsPanel } from '../documents/CommentsPanel';
import { VersionHistoryPanel } from '../documents/VersionHistoryPanel';
import { SharePanel } from '../documents/SharePanel';
import { EditorToolbar } from './components/EditorToolbar';
import {
  PlaceholderForm,
  type PlaceholderFormHandle,
} from './components/PlaceholderForm';
import { TemplateGallery } from './components/TemplateGallery';
import { PaginatedPreview } from './components/PaginatedPreview';
import { PageNavigator } from './components/PageNavigator';
import { TEMPLATES, getTemplateById } from './templates/registry';
import type { DocumentTemplate, PlaceholderDef } from './templates/types';
import { downloadWordDoc } from './export-word';
import { DEFAULT_LANGUAGE, LanguageSelect } from '../../lib/languages';
import { PageSizeSelect } from '../../lib/page-sizes';
import { DocumentFontSelect } from '../../lib/document-fonts';
import type { PageSizeKey } from '@org/document-templates';

const DEFAULT_TEMPLATE_ID = 'rent-agreement';
const DRAFT_KEY = 'legaldraft:editor:draft:v1';
const PANEL_VISIBILITY_KEY = 'editor:panel-visibility:v1';

/** Snapshot of editor state handed to persistence callbacks. */
export type EditorDraftState = {
  templateId: string;
  title: string;
  html: string;
  values: Record<string, string>;
  /** Document-level font (any Google Fonts family); persisted in `data`. */
  fontFamily?: string;
  /** Typed field defs for the doc's tokens; persisted in `data.fields`. */
  fields?: PlaceholderDef[];
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
        pageSize?: PageSizeKey;
        fontFamily?: string;
        /** Typed field defs (e.g. from convert) → render typed inputs, not plain text. */
        fields?: PlaceholderDef[];
      };
      onSave: (s: EditorDraftState) => void;
      /** Called when the user changes the paper size (bound mode persists it). */
      onPageSizeChange?: (size: PageSizeKey) => void;
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
  /** When provided, a "Draft with AI" action prompts for a brief + language and replaces the document. */
  onAiGenerate?: (
    brief: string,
    language: string,
  ) => Promise<{ html: string; disclaimer?: string }>;
  /** When provided, a "Revise with AI" action applies an instruction (and optional target language) to the current HTML. */
  onAiRevise?: (
    instruction: string,
    html: string,
    language?: string,
  ) => Promise<{ html: string }>;
  /** When provided, the PDF button uses this (the reliable backend export) instead of window.print. */
  onExportPdf?: () => void;
  exportingPdf?: boolean;
  /** When provided (bound docs), shows a Signatures action in the top bar. */
  onSignatures?: () => void;
  /** When set, the activity rail renders an inline "Legal & AI" panel that
   *  mounts `<DocumentSidePanel documentId={…}>` in the left rail. */
  documentId?: string;
  /** Extra rendered HTML appended in the preview (e.g. signatures + audit). */
  previewAppendHtml?: string;
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
  onSignatures,
  documentId,
  previewAppendHtml,
}: {
  persistence: EditorPersistence;
  backHref?: string;
  onSaveToCloud?: (s: EditorDraftState) => void;
  savingToCloud?: boolean;
  onAiGenerate?: (
    brief: string,
    language: string,
  ) => Promise<{ html: string; disclaimer?: string }>;
  onAiRevise?: (
    instruction: string,
    html: string,
    language?: string,
  ) => Promise<{ html: string }>;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
  onSignatures?: () => void;
  documentId?: string;
  previewAppendHtml?: string;
}) {
  const { t } = useTranslation();
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
    pageSize: PageSizeKey;
    fontFamily?: string;
  }>(() => {
    if (persistence.mode === 'bound') {
      const tpl =
        getTemplateById(persistence.initial.templateId ?? '') ??
        synthesizeTemplate(persistence.initial);
      return {
        template: tpl,
        values: persistence.initial.values,
        html: persistence.initial.html,
        savedAt: persistence.savedAt ?? null,
        pageSize: persistence.initial.pageSize ?? 'a4',
        fontFamily: persistence.initial.fontFamily,
      };
    }
    const tpl =
      getTemplateById(restored?.templateId ?? DEFAULT_TEMPLATE_ID) ??
      TEMPLATES[0];
    return {
      template: tpl,
      values: restored?.values ?? seedValues(tpl.placeholders),
      html: restored?.html ?? tpl.html,
      savedAt: restored?.savedAt ?? null,
      pageSize: restored?.pageSize ?? 'a4',
      fontFamily: restored?.fontFamily,
    };
  }, []);
  const [template, setTemplate] = useState<DocumentTemplate>(init.template);
  const [values, setValues] = useState<Record<string, string>>(init.values);
  const [html, setHtml] = useState<string>(init.html);
  const [savedAt, setSavedAt] = useState<number | null>(init.savedAt);
  const [pageSize, setPageSize] = useState<PageSizeKey>(init.pageSize);
  const [fontFamily, setFontFamily] = useState<string | undefined>(
    init.fontFamily,
  );

  const handlePageSizeChange = useCallback(
    (size: PageSizeKey) => {
      setPageSize(size);
      if (persistence.mode === 'bound') persistence.onPageSizeChange?.(size);
    },
    [persistence],
  );
  const [galleryOpen, setGalleryOpen] = useState(false);
  type SidebarTab =
    | 'fields'
    | 'pages'
    | 'legal-ai-citations'
    | 'legal-ai-insights'
    | 'legal-ai-usage'
    | 'comments'
    | 'history'
    | 'share';
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('fields');
  const [showPreview, setShowPreview] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  // Persisted per-panel visibility (which menu items the user has hidden).
  // Lives in localStorage so the preference survives reloads / new docs.
  const [hiddenPanels, setHiddenPanels] = useState<Set<string>>(() =>
    loadHiddenPanels(),
  );
  useEffect(() => {
    saveHiddenPanels(hiddenPanels);
  }, [hiddenPanels]);
  const togglePanelVisibility = useCallback((id: string) => {
    setHiddenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  // lg+ shows the resizable 3-pane layout; below that we show one pane at a
  // time via a segmented control (3 columns are unusable on a phone).
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [mobilePane, setMobilePane] = useState<'fields' | 'editor' | 'preview'>(
    'editor',
  );
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

  const handleDismissSuggestions = useCallback(
    () => setTranslitState(null),
    [],
  );

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
    const storage = editor.storage.transliteration as
      | TransliterationState
      | undefined;
    if (storage) {
      storage.enabled = enabled;
      storage.language = language;
    }
    if (!enabled) setTranslitState(null);
  }, [editor, enabled, language]);

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      if (!editor) return;
      const state = editor.storage.transliteration as
        | TransliterationState
        | undefined;
      if (state) {
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
      toast.message(
        t('editor.toast.draftRestored', 'Restored your last draft'),
        {
          description: t(
            'editor.toast.draftRestoredDesc',
            'Your in-progress document was recovered from this browser.',
          ),
        },
      );
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
    const timer = setTimeout(() => {
      if (p.mode === 'bound') {
        p.onSave({
          templateId: template.id,
          title: template.name,
          html,
          values,
          fontFamily,
          fields: template.placeholders,
        });
      } else {
        const now = Date.now();
        saveDraft({
          templateId: template.id,
          html,
          values,
          pageSize,
          fontFamily,
          savedAt: now,
        });
        setSavedAt(now);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [
    template.id,
    template.name,
    template.placeholders,
    html,
    values,
    pageSize,
    fontFamily,
  ]);

  // Bound mode: reflect the parent-reported save time in the status bar.
  const boundSavedAt =
    persistence.mode === 'bound' ? (persistence.savedAt ?? null) : null;
  useEffect(() => {
    if (persistence.mode === 'bound') setSavedAt(boundSavedAt);
  }, [persistence.mode, boundSavedAt]);

  const isSaving =
    persistence.mode === 'bound' ? !!persistence.saving : !!savingToCloud;

  const loadTemplate = useCallback(
    (tpl: DocumentTemplate) => {
      setTemplate(tpl);
      const seeded = seedValues(tpl.placeholders);
      setValues(seeded);
      setHtml(tpl.html);
      editor?.commands.setContent(tpl.html);
      setActivePage(0);
      toast.success(
        t('editor.toast.templateLoaded', 'Loaded template: {{name}}', {
          name: tpl.name,
        }),
      );
    },
    [editor, t],
  );

  const handleGenerate = useCallback(async () => {
    if (!editor) return;
    // Fallback when no AI provider is wired: re-seed from the template.
    toast.message(t('editor.toast.reloadingTemplate', 'Reloading template...'));
    await new Promise((r) => setTimeout(r, 400));
    editor.commands.setContent(template.html);
    setHtml(template.html);
    setValues(seedValues(template.placeholders));
    setActivePage(0);
    toast.success(t('editor.toast.templateReloaded', 'Template reloaded'));
  }, [editor, template, t]);

  const [aiBusy, setAiBusy] = useState(false);

  // --- Modal state for AI Generate ---
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateBrief, setGenerateBrief] = useState('');
  const [generateLanguage, setGenerateLanguage] = useState(DEFAULT_LANGUAGE);

  const handleAiGenerateOpen = useCallback(() => {
    if (!editor || !onAiGenerate) return;
    setGenerateBrief('');
    setGenerateModalOpen(true);
  }, [editor, onAiGenerate]);

  const handleAiGenerateSubmit = useCallback(async () => {
    if (!editor || !onAiGenerate || !generateBrief.trim()) return;
    setGenerateModalOpen(false);
    setAiBusy(true);
    toast.message(t('editor.toast.drafting', 'Drafting with AI…'));
    try {
      const { html: out, disclaimer } = await onAiGenerate(
        generateBrief.trim(),
        generateLanguage,
      );
      editor.commands.setContent(out);
      setHtml(out);
      setValues({});
      setActivePage(0);
      toast.success(
        t('editor.toast.draftGenerated', 'Draft generated'),
        disclaimer ? { description: disclaimer } : undefined,
      );
    } catch {
      toast.error(
        t(
          'editor.toast.generateFailed',
          'AI generation failed. Check your AI provider / quota.',
        ),
      );
    } finally {
      setAiBusy(false);
    }
  }, [editor, onAiGenerate, generateBrief, generateLanguage, t]);

  // --- Modal state for AI Revise ---
  const [reviseModalOpen, setReviseModalOpen] = useState(false);
  const [reviseInstruction, setReviseInstruction] = useState('');
  const [reviseLanguage, setReviseLanguage] = useState('');
  // Staged AI revision awaiting the user's accept/reject decision.
  const [pendingRevision, setPendingRevision] = useState<{
    before: string;
    after: string;
  } | null>(null);

  const handleAiReviseOpen = useCallback(() => {
    if (!editor || !onAiRevise) return;
    setReviseInstruction('');
    setReviseLanguage('');
    setReviseModalOpen(true);
  }, [editor, onAiRevise]);

  const handleAiReviseSubmit = useCallback(async () => {
    if (!editor || !onAiRevise) return;
    // Allow translate-only: if a target language is picked, an empty
    // instruction still works.
    const instruction =
      reviseInstruction.trim() ||
      (reviseLanguage ? `Translate this document into ${reviseLanguage}.` : '');
    if (!instruction) return;
    setReviseModalOpen(false);
    setAiBusy(true);
    toast.message(t('editor.toast.revising', 'Revising with AI…'));
    try {
      const { html: out } = await onAiRevise(
        instruction,
        html,
        reviseLanguage || undefined,
      );
      // Don't apply yet — stage it and let the user review the diff.
      setPendingRevision({ before: html, after: out });
    } catch {
      toast.error(
        t(
          'editor.toast.reviseFailed',
          'AI revision failed. Check your AI provider / quota.',
        ),
      );
    } finally {
      setAiBusy(false);
    }
  }, [editor, onAiRevise, reviseInstruction, reviseLanguage, html, t]);

  const acceptRevision = useCallback(() => {
    if (!editor || !pendingRevision) return;
    editor.commands.setContent(pendingRevision.after);
    setHtml(pendingRevision.after);
    setActivePage(0);
    setPendingRevision(null);
    toast.success(t('editor.toast.revisionApplied', 'Revision applied'));
  }, [editor, pendingRevision, t]);

  const rejectRevision = useCallback(() => {
    setPendingRevision(null);
    toast.message(t('editor.toast.revisionDiscarded', 'Revision discarded'));
  }, [t]);

  // Inline word-level diff of the staged revision (plain text — shows what the
  // AI changed, not HTML structure).
  const revisionDiff = useMemo<DiffSegment[] | null>(() => {
    if (!pendingRevision) return null;
    return diffText(
      stripHtmlToText(pendingRevision.before),
      stripHtmlToText(pendingRevision.after),
    );
  }, [pendingRevision]);
  const revisionUnchanged = useMemo(
    () =>
      pendingRevision
        ? isUnchanged(
            stripHtmlToText(pendingRevision.before),
            stripHtmlToText(pendingRevision.after),
          )
        : false,
    [pendingRevision],
  );

  // --- Modal state for Insert Placeholder ---
  const [placeholderModalOpen, setPlaceholderModalOpen] = useState(false);
  const [placeholderKey, setPlaceholderKey] = useState('');

  const handleInsertPlaceholderOpen = useCallback(() => {
    if (!editor) return;
    setPlaceholderKey('');
    setPlaceholderModalOpen(true);
  }, [editor]);

  const handleInsertPlaceholderSubmit = useCallback(() => {
    if (!editor) return;
    const cleaned = placeholderKey.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleaned) {
      toast.error(t('editor.toast.invalidFieldKey', 'Invalid field key'));
      return;
    }
    setPlaceholderModalOpen(false);
    editor.chain().focus().insertContent(`{{${cleaned}}}`).run();
  }, [editor, placeholderKey, t]);

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
      editor.chain().focus().setNodeSelection(breakPos).deleteSelection().run();
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
      toast.success(
        t('editor.toast.copied', 'Copied document text to clipboard'),
      );
    } catch {
      toast.error(t('editor.toast.copyFailed', 'Could not copy'));
    }
  }, [html, values, t]);

  const handleExportWord = useCallback(() => {
    downloadWordDoc({
      filename: template.name,
      title: template.name,
      html,
      values,
    });
    toast.success(t('editor.toast.wordDownloaded', 'Word document downloaded'));
  }, [template.name, html, values, t]);

  const handlePrint = useCallback(() => {
    const rendered = renderTemplateHtml(html, values);
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) {
      toast.error(t('editor.toast.printFailed', 'Could not open print window'));
      return;
    }
    const scriptOpen = '<' + 'script>';
    const scriptClose = '<' + '/script>';
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeAttr(template.name)}</title><style>${PRINT_CSS}</style></head><body>${rendered}${scriptOpen}window.onload=()=>setTimeout(()=>window.print(),200)${scriptClose}</body></html>`,
    );
    w.document.close();
  }, [html, values, template, t]);

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

  // The three panes are defined once and placed into either the desktop
  // resizable layout or the mobile single-pane switcher (one mount each, so
  // the single Tiptap EditorContent is never duplicated).
  // Side-menu items. Panel-kind items switch the inline section content;
  // action-kind items dispatch a callback (typically opens a dialog the
  // parent owns). Items requiring a `documentId` (Legal & AI, Comments,
  // History) only render when one is provided — keeps the menu honest.
  const menuItems: RailItem[] = [
    {
      id: 'fields',
      kind: 'panel',
      group: t('editor.group.content', 'Content'),
      label: t('editor.tabs.fields', 'Fields'),
      icon: <FieldsIcon />,
      active: sidebarTab === 'fields',
      badge:
        completionStats.total > 0
          ? `${completionStats.filled}/${completionStats.total}`
          : undefined,
      onClick: () => setSidebarTab('fields'),
    },
    {
      id: 'pages',
      kind: 'panel',
      group: t('editor.group.content', 'Content'),
      label: t('editor.tabs.pages', 'Pages'),
      icon: <PagesIcon />,
      active: sidebarTab === 'pages',
      onClick: () => setSidebarTab('pages'),
    },
    ...(documentId
      ? [
          {
            id: 'legal-ai-citations',
            kind: 'panel' as const,
            group: t('editor.group.legalAi', 'Legal & AI'),
            label: t('editor.toolbar.citations', 'Citations'),
            icon: <CitationsIcon />,
            active: sidebarTab === 'legal-ai-citations',
            onClick: () => setSidebarTab('legal-ai-citations'),
          },
          {
            id: 'legal-ai-insights',
            kind: 'panel' as const,
            group: t('editor.group.legalAi', 'Legal & AI'),
            label: t('editor.toolbar.insights', 'Insights'),
            icon: <InsightsIcon />,
            active: sidebarTab === 'legal-ai-insights',
            onClick: () => setSidebarTab('legal-ai-insights'),
          },
          {
            id: 'legal-ai-usage',
            kind: 'panel' as const,
            group: t('editor.group.legalAi', 'Legal & AI'),
            label: t('editor.toolbar.usage', 'Usage'),
            icon: <UsageIcon />,
            active: sidebarTab === 'legal-ai-usage',
            onClick: () => setSidebarTab('legal-ai-usage'),
          },
          {
            id: 'comments',
            kind: 'panel' as const,
            group: t('editor.group.collaborate', 'Collaborate'),
            label: t('editor.toolbar.comments', 'Comments'),
            icon: <CommentsIcon />,
            active: sidebarTab === 'comments',
            onClick: () => setSidebarTab('comments'),
          },
          {
            id: 'history',
            kind: 'panel' as const,
            group: t('editor.group.collaborate', 'Collaborate'),
            label: t('editor.toolbar.history', 'History'),
            icon: <RailHistoryIcon />,
            active: sidebarTab === 'history',
            onClick: () => setSidebarTab('history'),
          },
        ]
      : []),
    ...(documentId
      ? [
          {
            id: 'share',
            kind: 'panel' as const,
            group: t('editor.group.collaborate', 'Collaborate'),
            label: t('editor.toolbar.share', 'Share'),
            icon: <RailShareIcon />,
            active: sidebarTab === 'share',
            onClick: () => setSidebarTab('share'),
          },
        ]
      : []),
    ...(onSignatures
      ? [
          {
            id: 'signatures',
            kind: 'action' as const,
            group: t('editor.group.collaborate', 'Collaborate'),
            label: t('editor.toolbar.signatures', 'Signatures'),
            icon: <SignaturesIcon />,
            onClick: onSignatures,
          },
        ]
      : []),
  ];

  // The visibility list is the *full* set of available items — drives the
  // Customize popover. The menu itself renders only the not-hidden subset.
  const visibleMenuItems = menuItems.filter((it) => !hiddenPanels.has(it.id));

  // If the active section's been hidden, fall back to the first visible
  // panel so the section column never goes blank.
  useEffect(() => {
    if (!hiddenPanels.has(sidebarTab)) return;
    const firstVisiblePanel = visibleMenuItems.find((i) => i.kind === 'panel');
    if (firstVisiblePanel) setSidebarTab(firstVisiblePanel.id as SidebarTab);
  }, [hiddenPanels, sidebarTab, visibleMenuItems]);

  const customizeButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('editor.customize.button', 'Customize sidebar')}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-foreground/55 hover:bg-secondary hover:text-foreground"
        >
          <GearIcon />
          <span className="flex-1 truncate">
            {t('editor.customize.button', 'Customize sidebar')}
          </span>
          {hiddenPanels.size > 0 && (
            <span className="rounded bg-secondary px-1 text-[9px] font-semibold text-foreground/60">
              {menuItems.length - hiddenPanels.size}/{menuItems.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <DropdownMenuLabel>
          {t('editor.customize.label', 'Show in sidebar')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menuItems.map((it) => (
          <DropdownMenuCheckboxItem
            key={it.id}
            checked={!hiddenPanels.has(it.id)}
            onCheckedChange={() => togglePanelVisibility(it.id)}
            onSelect={(e) => e.preventDefault()}
          >
            <span className="flex items-center gap-2">
              <span className="flex size-4 items-center justify-center text-foreground/60">
                {it.icon}
              </span>
              <span>{it.label}</span>
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const sidebarPane = (
    <aside className="flex h-full w-full bg-background">
      <EditorSideMenu items={visibleMenuItems} footer={customizeButton} />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Section header — title for the active view */}
        <div className="flex-none border-b border-border px-3 py-2 text-xs font-semibold text-foreground/80">
          {sidebarTab === 'fields' && t('editor.tabs.fields', 'Fields')}
          {sidebarTab === 'pages' && t('editor.tabs.pages', 'Pages')}
          {sidebarTab === 'legal-ai-citations' &&
            t('editor.toolbar.citations', 'Citations')}
          {sidebarTab === 'legal-ai-insights' &&
            t('editor.toolbar.insights', 'Insights')}
          {sidebarTab === 'legal-ai-usage' &&
            t('editor.toolbar.usage', 'Usage')}
          {sidebarTab === 'comments' &&
            t('editor.toolbar.comments', 'Comments')}
          {sidebarTab === 'history' && t('editor.toolbar.history', 'History')}
          {sidebarTab === 'share' && t('editor.toolbar.share', 'Share')}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {sidebarTab === 'fields' && (
            <>
              {completionStats.total > 0 && (
                <div className="border-b border-border bg-secondary/35 px-4 py-2">
                  <div className="flex items-center justify-between text-[11px] text-foreground/60">
                    <span>{t('editor.completion', 'Completion')}</span>
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
            </>
          )}
          {sidebarTab === 'pages' && (
            <PageNavigator
              html={html}
              activePage={activePage}
              onJumpToPage={handleJumpToPage}
              onAddPage={handleAddPage}
              onRemovePage={handleRemovePage}
            />
          )}
          {sidebarTab === 'legal-ai-citations' && documentId && (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
              <CitationHealth documentId={documentId} />
            </div>
          )}
          {sidebarTab === 'legal-ai-insights' && documentId && (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
              <DocumentInsights sourceId={documentId} scope="document" />
            </div>
          )}
          {sidebarTab === 'legal-ai-usage' && documentId && (
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
              <AiUsageSummary scope={{ kind: 'document', id: documentId }} />
            </div>
          )}
          {sidebarTab === 'comments' && documentId && (
            <CommentsPanel documentId={documentId} />
          )}
          {sidebarTab === 'history' && documentId && (
            <VersionHistoryPanel documentId={documentId} />
          )}
          {sidebarTab === 'share' && documentId && (
            <SharePanel documentId={documentId} />
          )}
        </div>
      </div>
    </aside>
  );

  const editorPane = (
    <section className="flex h-full flex-col overflow-hidden bg-background">
      {editor && (
        <EditorToolbar
          editor={editor}
          onInsertPlaceholder={handleInsertPlaceholderOpen}
          onInsertPageBreak={handleInsertPageBreak}
        />
      )}
      <div
        ref={editorScrollRef}
        className="relative flex-1 overflow-y-auto bg-background"
      >
        <div className="mx-auto  px-4 py-6 sm:px-8">
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
        <span className="truncate">
          {t(
            'editor.status.counts',
            '{{chars}} chars · {{words}} words · Page {{page}}',
            {
              chars: editor?.getText().length ?? 0,
              words: editor
                ? editor.getText().split(/\s+/).filter(Boolean).length
                : 0,
              page: activePage + 1,
            },
          )}
        </span>
        <span className="flex flex-none items-center gap-1.5">
          <span
            className={cn(
              'inline-block size-1.5 rounded-full',
              savedAt ? 'bg-emerald-500' : 'bg-amber-400',
            )}
          />
          {isSaving
            ? t('editor.status.saving', 'Saving…')
            : savedAt
              ? `${bound ? t('editor.status.savedToCloud', 'Saved to cloud') : t('editor.status.saved', 'Saved')} ${formatTime(savedAt)}`
              : bound
                ? t('editor.status.saving', 'Saving…')
                : t('editor.status.notSaved', 'Not saved yet')}
        </span>
      </div>
    </section>
  );

  const previewPane = (
    <PaginatedPreview
      html={html}
      values={values}
      pageSize={pageSize}
      fontFamily={fontFamily}
      appendHtml={previewAppendHtml}
      activePage={activePage}
      onSelectPage={handleJumpToPage}
      className="h-full"
    />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-secondary/50">
      {/* Top bar — two rows: identity + primary (row 1), grouped actions (row 2) */}
      <header className="flex-none border-b border-border bg-background">
        {/* Row 1 — identity + primary actions */}
        <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {backHref && (
              <Link
                to={backHref}
                aria-label={t('editor.back', 'Back')}
                className="flex size-8 flex-none items-center justify-center rounded-md text-foreground/60 hover:bg-secondary/60 hover:text-foreground"
              >
                <BackIcon />
              </Link>
            )}
            <div className="flex size-8 flex-none items-center justify-center rounded-md bg-secondary/60 text-lg">
              {template.icon}
            </div>
            <div className="min-w-0 flex-1">
              <input
                value={template.name}
                onChange={(e) =>
                  setTemplate((tpl) => ({ ...tpl, name: e.target.value }))
                }
                placeholder={t('editor.untitled', 'Untitled document')}
                aria-label={t('editor.titleLabel', 'Document title')}
                className="w-full min-w-0 rounded border-0 bg-transparent px-1.5 py-0.5 text-sm font-semibold leading-tight focus:bg-foreground/5 focus:outline-none"
              />
              <div className="truncate px-1.5 text-[11px] text-foreground/55">
                {t(
                  'editor.meta.fieldsFilled',
                  '{{category}} · {{filled}}/{{total}} fields filled',
                  {
                    category: template.category,
                    filled: completionStats.filled,
                    total: completionStats.total,
                  },
                )}
                {enabled &&
                  t('editor.meta.transliterationOn', ' · Transliteration on')}
              </div>
            </div>
          </div>

          <div className="flex flex-none items-center gap-1.5">
            <ToolbarGroup label={t('editor.group.create', 'Create with AI')}>
              {onAiGenerate ? (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={aiBusy}
                  onClick={handleAiGenerateOpen}
                  className="gap-1.5 text-xs"
                >
                  <SparklesIcon />
                  <span className="hidden sm:inline">
                    {t('editor.toolbar.draftWithAi', 'Draft with AI')}
                  </span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  className="gap-1.5 text-xs"
                >
                  <SparklesIcon />
                  <span className="hidden sm:inline">
                    {t('editor.toolbar.reloadTemplate', 'Reload template')}
                  </span>
                </Button>
              )}
              {onAiRevise && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={aiBusy}
                  onClick={handleAiReviseOpen}
                  className="gap-1.5 text-xs"
                >
                  <SparklesIcon />
                  <span className="hidden sm:inline">
                    {t('editor.toolbar.reviseWithAi', 'Revise with AI')}
                  </span>
                </Button>
              )}
            </ToolbarGroup>

            <ToolbarDivider />

            {onExportPdf ? (
              <Button
                size="sm"
                isLoading={exportingPdf}
                onClick={onExportPdf}
                className="gap-1.5 text-xs"
              >
                <PrintIcon />
                {t('editor.toolbar.exportPdf', 'Export PDF')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5 text-xs"
              >
                <PrintIcon />
                {t('editor.toolbar.print', 'Print')}
              </Button>
            )}
          </div>
        </div>

        {/* Row 2 — grouped secondary actions */}
        <div className="flex items-center gap-1 overflow-x-auto px-3 pb-1.5 text-foreground/75">
          <ToolbarGroup label={t('editor.group.file', 'Document & file')}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGalleryOpen(true)}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <GalleryIcon />
              {t('editor.toolbar.templates', 'Templates')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <CopyIcon />
              {t('editor.toolbar.copy', 'Copy')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportWord}
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <DownloadIcon />
              {t('editor.toolbar.word', 'Word')}
            </Button>
            {persistence.mode === 'local' && onSaveToCloud && (
              <Button
                variant="ghost"
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
                className="h-7 gap-1.5 px-2 text-xs"
              >
                <CloudIcon />
                {t('editor.toolbar.saveToDocuments', 'Save to my documents')}
              </Button>
            )}
          </ToolbarGroup>

          {/* Collaborate buttons (Share/Comments/Signatures/Legal&AI/History)
              now live in the left activity rail — kept off the top toolbar
              to reduce horizontal crowding. The rail is the single source of
              truth for those actions. */}

          <div className="ml-auto flex flex-none items-center gap-2 pl-2">
            <DocumentFontSelect value={fontFamily} onChange={setFontFamily} />
            <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} />
            <LayoutPresetGroup
              showSidebar={showSidebar}
              showPreview={showPreview}
              onChange={(s, p) => {
                setShowSidebar(s);
                setShowPreview(p);
              }}
              t={t}
            />
          </div>
        </div>
      </header>

      {isDesktop ? (
        /* ── Desktop: resizable 3-pane layout (menu | editor | preview).
              Preview defaults to a compact 28% width and can be hidden via
              the top-bar toggle. The sidebar is wider (30%) to fit the
              labeled side menu + active section content. Both sidebar and
              preview can be hidden independently via top-bar toggles. ── */
        <Group orientation="horizontal" className="flex-1">
          {showSidebar && (
            <>
              <Panel
                id="sidebar"
                defaultSize="30%"
                minSize="22%"
                maxSize="42%"
                className="min-w-0"
              >
                <div className="h-full border-r border-border">
                  {sidebarPane}
                </div>
              </Panel>

              <Separator className="relative flex w-1.5 items-center justify-center bg-border/50 transition-colors hover:bg-primary/40 active:bg-primary/50">
                <div className="h-8 w-0.5 rounded-full bg-foreground/20" />
              </Separator>
            </>
          )}

          <Panel
            id="editor"
            defaultSize={
              showPreview && showSidebar
                ? '42%'
                : showPreview
                  ? '72%'
                  : showSidebar
                    ? '70%'
                    : '100%'
            }
            minSize="28%"
            className="min-w-0"
          >
            {editorPane}
          </Panel>

          {showPreview && (
            <>
              <Separator className="relative flex w-1.5 items-center justify-center bg-border/50 transition-colors hover:bg-primary/40 active:bg-primary/50">
                <div className="h-8 w-0.5 rounded-full bg-foreground/20" />
              </Separator>
              <Panel
                id="preview"
                defaultSize="28%"
                minSize="18%"
                className="min-w-0 border-l border-border"
              >
                {previewPane}
              </Panel>
            </>
          )}
        </Group>
      ) : (
        /* ── Mobile / tablet: one pane at a time ── */
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-none items-center gap-1 border-b border-border bg-background p-1">
            {(['fields', 'editor', 'preview'] as const).map((pane) => (
              <button
                key={pane}
                type="button"
                onClick={() => setMobilePane(pane)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  mobilePane === pane
                    ? 'bg-primary/50 text-primary'
                    : 'text-foreground/55 hover:text-foreground',
                )}
              >
                {pane === 'fields'
                  ? t('editor.tabs.fields', 'Fields')
                  : pane === 'editor'
                    ? t('editor.mobile.editor', 'Editor')
                    : t('editor.mobile.preview', 'Preview')}
              </button>
            ))}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1',
              mobilePane === 'fields' ? 'block' : 'hidden',
            )}
          >
            {sidebarPane}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1',
              mobilePane === 'editor' ? 'block' : 'hidden',
            )}
          >
            {editorPane}
          </div>
          <div
            className={cn(
              'min-h-0 flex-1',
              mobilePane === 'preview' ? 'block' : 'hidden',
            )}
          >
            {previewPane}
          </div>
        </div>
      )}

      <TemplateGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={loadTemplate}
        activeId={template.id}
      />

      {/* AI Generate Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('editor.toolbar.draftWithAi', 'Draft with AI')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'editor.generate.description',
                'Describe the document you want to draft. Be specific about parties, terms, and key details.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            <Label htmlFor="ai-generate-brief">
              {t('editor.generate.briefLabel', 'Document description')}
            </Label>
            <Textarea
              id="ai-generate-brief"
              placeholder={t(
                'editor.generate.briefPlaceholder',
                'e.g. "Rent agreement, landlord Ramesh, tenant Priya, 2BHK Pune, ₹25,000/mo, 11-month term"',
              )}
              value={generateBrief}
              onChange={(e) => setGenerateBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleAiGenerateSubmit();
                }
              }}
              rows={4}
              autoFocus
            />
            <Label htmlFor="ai-generate-language" className="mt-1">
              {t('editor.generate.language', 'Language')}
            </Label>
            <LanguageSelect
              id="ai-generate-language"
              value={generateLanguage}
              onChange={setGenerateLanguage}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGenerateModalOpen(false)}
            >
              {t('editor.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              disabled={!generateBrief.trim()}
              onClick={handleAiGenerateSubmit}
            >
              {t('editor.generate.submit', 'Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Revise Modal */}
      <Dialog open={reviseModalOpen} onOpenChange={setReviseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('editor.toolbar.reviseWithAi', 'Revise with AI')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'editor.revise.description',
                'Tell the AI how to modify the current document.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            <Label htmlFor="ai-revise-instruction">
              {t('editor.revise.instructionLabel', 'Revision instruction')}
            </Label>
            <Textarea
              id="ai-revise-instruction"
              placeholder={t(
                'editor.revise.instructionPlaceholder',
                'e.g. "make the deposit 2 months", "add a no-pets clause", "make it more tenant-friendly"',
              )}
              value={reviseInstruction}
              onChange={(e) => setReviseInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleAiReviseSubmit();
                }
              }}
              rows={3}
              autoFocus
            />
            <Label htmlFor="ai-revise-language" className="mt-1">
              {t('editor.revise.translateTo', 'Translate to (optional)')}
            </Label>
            <LanguageSelect
              id="ai-revise-language"
              value={reviseLanguage}
              onChange={setReviseLanguage}
              includeKeepOption
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviseModalOpen(false)}
            >
              {t('editor.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              disabled={!reviseInstruction.trim() && !reviseLanguage}
              onClick={handleAiReviseSubmit}
            >
              {t('editor.revise.submit', 'Revise')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Revision — review diff before applying */}
      <Dialog
        open={!!pendingRevision}
        onOpenChange={(v) => {
          if (!v) rejectRevision();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('editor.diff.title', 'Review AI revision')}
            </DialogTitle>
            <DialogDescription>
              <span className="bg-success/25">
                {t('editor.diff.green', 'Green')}
              </span>{' '}
              {t('editor.diff.isAdded', 'is added,')}{' '}
              <span className="bg-error/20 line-through">
                {t('editor.diff.red', 'red')}
              </span>{' '}
              {t(
                'editor.diff.isRemoved',
                'is removed. Accept to apply, or reject to keep the current document.',
              )}
            </DialogDescription>
          </DialogHeader>
          {revisionUnchanged ? (
            <p className="py-3 text-sm text-foreground/60">
              {t(
                'editor.diff.noChanges',
                'The AI returned no visible text changes (formatting or placeholder tweaks only). You can still apply it.',
              )}
            </p>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-secondary-accent/40 p-3 text-sm leading-relaxed text-foreground/80">
              {revisionDiff?.map((seg, idx) =>
                seg.op === 'equal' ? (
                  <span key={idx} className="text-foreground/70">
                    {seg.text}
                  </span>
                ) : seg.op === 'added' ? (
                  <span key={idx} className="rounded-sm bg-success/25">
                    {seg.text}
                  </span>
                ) : (
                  <span
                    key={idx}
                    className="rounded-sm bg-error/20 line-through opacity-80"
                  >
                    {seg.text}
                  </span>
                ),
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={rejectRevision}>
              {t('editor.diff.reject', 'Reject')}
            </Button>
            <Button size="sm" onClick={acceptRevision}>
              {t('editor.diff.accept', 'Accept revision')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insert Placeholder Modal */}
      <Dialog
        open={placeholderModalOpen}
        onOpenChange={setPlaceholderModalOpen}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t('editor.placeholder.title', 'Insert field placeholder')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'editor.placeholder.description',
                'Enter a key for the placeholder field. Use letters, numbers, or underscores only.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            <Label htmlFor="placeholder-key">
              {t('editor.placeholder.fieldKey', 'Field key')}
            </Label>
            <Input
              id="placeholder-key"
              placeholder={t(
                'editor.placeholder.keyPlaceholder',
                'e.g. tenant_name',
              )}
              value={placeholderKey}
              onChange={(e) => setPlaceholderKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInsertPlaceholderSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlaceholderModalOpen(false)}
            >
              {t('editor.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              disabled={!placeholderKey.trim()}
              onClick={handleInsertPlaceholderSubmit}
            >
              {t('editor.placeholder.insert', 'Insert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  onSignatures,
  documentId,
  previewAppendHtml,
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
        onSignatures={onSignatures}
        documentId={documentId}
        previewAppendHtml={previewAppendHtml}
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
  fields?: PlaceholderDef[];
}): DocumentTemplate {
  return {
    id: init.templateId ?? 'freeform',
    name: init.title ?? 'Document',
    description: '',
    category: 'Document',
    icon: '📄',
    html: init.html,
    // Typed defs (e.g. carried from convert) drive the Fields panel; tokens
    // without a def still fall through to custom text inputs.
    placeholders: init.fields ?? [],
  };
}

type DraftData = {
  templateId: string;
  html: string;
  values: Record<string, string>;
  pageSize?: PageSizeKey;
  fontFamily?: string;
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

function loadHiddenPanels(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(PANEL_VISIBILITY_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveHiddenPanels(set: Set<string>): void {
  try {
    window.localStorage.setItem(PANEL_VISIBILITY_KEY, JSON.stringify([...set]));
  } catch {
    /* best-effort */
  }
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

// --- toolbar layout helpers ---

/** A thin vertical rule separating clusters of toolbar buttons. */
function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px flex-none bg-border/70" />;
}

/** A labelled cluster of related toolbar actions (screen-reader group). */
function ToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {children}
    </div>
  );
}

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

function GearIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
