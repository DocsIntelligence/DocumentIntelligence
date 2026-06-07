import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const DEFAULT_TEMPLATE_ID = 'rent-agreement';

function TemplateEditorInner() {
  const { enabled } = useTransliteration();
  const initialTemplate = useMemo(
    () => getTemplateById(DEFAULT_TEMPLATE_ID) ?? TEMPLATES[0],
    [],
  );
  const [template, setTemplate] = useState<DocumentTemplate>(initialTemplate);
  const [values, setValues] = useState<Record<string, string>>(() =>
    seedValues(initialTemplate.placeholders),
  );
  const [html, setHtml] = useState<string>(initialTemplate.html);
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
    ],
    content: initialTemplate.html,
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
    // Simulate an AI generation by re-loading the current template's html.
    toast.message('Generating draft...');
    await new Promise((r) => setTimeout(r, 800));
    editor.commands.setContent(template.html);
    setHtml(template.html);
    setValues(seedValues(template.placeholders));
    setActivePage(0);
    toast.success('Draft generated');
  }, [editor, template]);

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

  const handleDownload = useCallback(() => {
    const rendered = renderTemplateHtml(html, values);
    const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeAttr(template.name)}</title><style>${PRINT_CSS}</style></head><body>${rendered}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(template.name)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [html, values, template]);

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
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-secondary/10">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            className="gap-1.5 text-xs"
          >
            <SparklesIcon />
            Regenerate
          </Button>
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
            onClick={handleDownload}
            className="gap-1.5 text-xs"
          >
            <DownloadIcon />
            Download
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs"
          >
            <PrintIcon />
            Print / PDF
          </Button>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex w-[300px] flex-none flex-col border-r border-border bg-background">
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

        {/* Editor pane */}
        <section
          className={cn(
            'flex flex-col overflow-hidden border-r border-border bg-background',
            showPreview ? 'flex-1 min-w-0' : 'flex-1',
          )}
        >
          {editor && (
            <EditorToolbar
              editor={editor}
              onInsertPlaceholder={handleInsertPlaceholder}
              onInsertPageBreak={handleInsertPageBreak}
            />
          )}
          <div
            ref={editorScrollRef}
            className="flex-1 overflow-y-auto bg-background"
          >
            <div className="mx-auto max-w-3xl px-8 py-6">
              <EditorContent editor={editor} />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-background px-3 py-1 text-[11px] text-foreground/55">
            <span>
              {editor?.getText().length ?? 0} chars ·{' '}
              {editor
                ? editor.getText().split(/\s+/).filter(Boolean).length
                : 0}{' '}
              words · Page {activePage + 1}
            </span>
          </div>
        </section>

        {/* Preview pane */}
        {showPreview && (
          <section className="flex w-[46%] min-w-[420px] flex-none overflow-y-auto">
            <PaginatedPreview html={html} values={values} className="flex-1" />
          </section>
        )}
      </div>

      <TemplateGallery
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        onSelect={loadTemplate}
        activeId={template.id}
      />
    </div>
  );
}

export function TemplateEditor() {
  return (
    <TransliterationProvider defaultLanguage="hi" defaultEnabled={false}>
      <TemplateEditorInner />
    </TransliterationProvider>
  );
}

// --- helpers ---

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

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'document'
  );
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
