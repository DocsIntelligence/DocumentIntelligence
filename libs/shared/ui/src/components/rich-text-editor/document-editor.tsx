import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { cn } from '@org/utils';
import { useTransliteration } from '@org/transliteration';

import { Button } from '../button';
import { Separator } from '../separator';
import { Tooltip } from '../tooltip';

import './editor.css';
import {
  TransliterationExtension,
  type TransliterationState,
} from './transliteration-extension';
import { TransliterationToolbar } from './transliteration-toolbar';
import { SuggestionPopover } from './suggestion-popover';

export type DocumentEditorProps = {
  /** Initial HTML content (can be AI-generated with placeholders) */
  content?: string;
  /** Callback when content changes */
  onChange?: (html: string) => void;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Additional class for the outer container */
  className?: string;
  /** Whether the editor is read-only */
  editable?: boolean;
  /** Whether to show the preview panel by default */
  defaultShowPreview?: boolean;
  /** Called when user requests AI generation */
  onGenerateRequest?: () => Promise<string> | string;
  /** Whether AI generation is in progress */
  isGenerating?: boolean;
  /** Custom toolbar actions (rendered after built-in toolbar) */
  toolbarExtra?: React.ReactNode;
};

export function DocumentEditor({
  content = '',
  onChange,
  placeholder = 'Start writing or generate content with AI...',
  className,
  editable = true,
  defaultShowPreview = true,
  onGenerateRequest,
  isGenerating = false,
  toolbarExtra,
}: DocumentEditorProps) {
  const { enabled, language } = useTransliteration();
  const [showPreview, setShowPreview] = useState(defaultShowPreview);
  const [suggestions, setSuggestions] = useState<TransliterationState | null>(
    null,
  );
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [currentHtml, setCurrentHtml] = useState(content);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(50); // percentage
  const isDragging = useRef(false);

  const handleSuggestions = useCallback((state: TransliterationState) => {
    setSuggestions({ ...state });
    const editorEl = editorContainerRef.current?.querySelector('.ProseMirror');
    if (editorEl) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect =
          editorContainerRef.current!.getBoundingClientRect();
        setPopoverPosition({
          top: rect.bottom - containerRect.top + 4,
          left: rect.left - containerRect.left,
        });
      }
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setSuggestions(null);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TransliterationExtension.configure({
        language,
        enabled,
        debounceMs: 150,
        onSuggestions: handleSuggestions,
        onDismiss: handleDismiss,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setCurrentHtml(html);
      onChange?.(html);
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-full',
      },
    },
  });

  // Sync transliteration state
  if (editor) {
    const storage = editor.storage.transliteration as
      | TransliterationState
      | undefined;
    if (storage) {
      storage.enabled = enabled;
      storage.language = language;
    }
  }

  const injectContent = useCallback(
    (html: string) => {
      if (!editor) return;
      editor.commands.setContent(html);
      setCurrentHtml(html);
      onChange?.(html);
    },
    [editor, onChange],
  );

  const handleGenerate = useCallback(async () => {
    if (!onGenerateRequest) return;
    const result = await onGenerateRequest();
    if (result) injectContent(result);
  }, [onGenerateRequest, injectContent]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      setCurrentHtml(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

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
      setSuggestions(null);
    },
    [editor],
  );

  // Resizable panel drag handler
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const container = editorContainerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setPanelWidth(Math.max(30, Math.min(70, pct)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (!editor) return null;

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', className)}>
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center justify-between border-b border-border bg-background px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-0.5">
            <ToolbarButton
              active={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              tooltip="Bold"
            >
              <BoldIcon />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              tooltip="Italic"
            >
              <ItalicIcon />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              tooltip="Underline"
            >
              <UnderlineIcon />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              tooltip="Strikethrough"
            >
              <StrikeIcon />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1.5 h-4" />

            <ToolbarButton
              active={editor.isActive('heading', { level: 1 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              tooltip="Heading 1"
            >
              H1
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('heading', { level: 2 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              tooltip="Heading 2"
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('heading', { level: 3 })}
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              tooltip="Heading 3"
            >
              H3
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1.5 h-4" />

            <ToolbarButton
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              tooltip="Bullet list"
            >
              <ListIcon />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              tooltip="Numbered list"
            >
              <OrderedListIcon />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              tooltip="Quote"
            >
              <QuoteIcon />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1.5 h-4" />

            <ToolbarButton
              active={editor.isActive('highlight')}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              tooltip="Highlight"
            >
              <HighlightIcon />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1.5 h-4" />

            <TransliterationToolbar />

            {toolbarExtra && (
              <>
                <Separator orientation="vertical" className="mx-1.5 h-4" />
                {toolbarExtra}
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onGenerateRequest && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                isLoading={isGenerating}
                className="gap-1.5 text-xs"
              >
                <SparklesIcon />
                Generate
              </Button>
            )}
            <Button
              variant={showPreview ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-1.5 text-xs"
            >
              <SplitIcon />
              Preview
            </Button>
          </div>
        </div>
      )}

      {/* Main content area: Editor | Resize Handle | Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor pane */}
        <div
          ref={editorContainerRef}
          className="relative overflow-y-auto bg-background"
          style={{ width: showPreview ? `${panelWidth}%` : '100%' }}
        >
          <div className="mx-auto px-8 py-6 text-foreground">
            <EditorContent editor={editor} />

            {suggestions && (
              <SuggestionPopover
                suggestions={suggestions.suggestions}
                selectedIndex={suggestions.selectedIndex}
                onSelect={handleSuggestionSelect}
                visible={suggestions.showSuggestions}
                position={popoverPosition}
              />
            )}
          </div>
        </div>

        {/* Resize handle */}
        {showPreview && (
          <div
            className="group flex w-1.5 cursor-col-resize items-center justify-center bg-border/50 transition-colors hover:bg-primary/40 active:bg-primary/40"
            onMouseDown={handleMouseDown}
          >
            <div className="h-8 w-0.5 rounded-full bg-foreground/20 transition-colors group-hover:bg-primary/60" />
          </div>
        )}

        {/* Preview pane (artboard) */}
        {showPreview && (
          <div
            className="overflow-y-auto bg-muted"
            style={{ width: `${100 - panelWidth}%` }}
          >
            <div className="flex min-h-full flex-col items-center px-6 py-8">
              {/* A4 page */}
              <div
                className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-lg rounded-sm"
                style={{ padding: '20mm 18mm 18mm 18mm' }}
              >
                <div
                  className="document-preview-page"
                  dangerouslySetInnerHTML={{ __html: currentHtml }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      {editable && (
        <div className="flex items-center justify-between border-t border-border bg-background px-3 py-1 text-[11px] text-foreground/50">
          <span>
            {editor.getText().length} chars ·{' '}
            {editor.getText().split(/\s+/).filter(Boolean).length} words
          </span>
          <div className="flex items-center gap-3">
            {enabled && (
              <span className="flex items-center gap-1">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                Transliteration
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Toolbar button ---

function ToolbarButton({
  active,
  onClick,
  tooltip,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={tooltip}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className={cn(
          'size-7 p-0 text-xs font-medium',
          active && 'bg-primary/50 text-primary',
        )}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

// --- Icons ---

function BoldIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6zm0 8h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
      <line x1="4" y1="21" x2="20" y2="21" />
    </svg>
  );
}

function StrikeIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M16 4H9a3 3 0 0 0 0 6h6" />
      <path d="M8 20h7a3 3 0 0 0 0-6H4" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="5" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OrderedListIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="10" y1="6" x2="20" y2="6" />
      <line x1="10" y1="12" x2="20" y2="12" />
      <line x1="10" y1="18" x2="20" y2="18" />
      <text
        x="4"
        y="8"
        fontSize="7"
        fill="currentColor"
        stroke="none"
        fontWeight="600"
      >
        1
      </text>
      <text
        x="4"
        y="14"
        fontSize="7"
        fill="currentColor"
        stroke="none"
        fontWeight="600"
      >
        2
      </text>
      <text
        x="4"
        y="20"
        fontSize="7"
        fill="currentColor"
        stroke="none"
        fontWeight="600"
      >
        3
      </text>
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
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
