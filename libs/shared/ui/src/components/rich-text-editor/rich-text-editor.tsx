import { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
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

export type RichTextEditorProps = {
  /** Initial HTML content */
  content?: string;
  /** Callback when content changes */
  onChange?: (html: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class for the editor container */
  className?: string;
  /** Whether the editor is read-only */
  editable?: boolean;
  /** Minimum height of the editor */
  minHeight?: string;
};

export function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Start typing...',
  className,
  editable = true,
  minHeight = '200px',
}: RichTextEditorProps) {
  const { enabled, language } = useTransliteration();
  const [suggestions, setSuggestions] = useState<TransliterationState | null>(
    null,
  );
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleSuggestions = useCallback((state: TransliterationState) => {
    setSuggestions({ ...state });

    // Position the popover near the cursor
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
      onChange?.(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none',
          'min-h-[var(--editor-min-height)]',
        ),
        style: `--editor-min-height: ${minHeight}`,
      },
    },
  });

  // Sync transliteration state when props change
  if (editor) {
    const storage = editor.storage.transliteration as
      | TransliterationState
      | undefined;
    if (storage) {
      storage.enabled = enabled;
      storage.language = language;
    }
  }

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

        // Reset buffer
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

  if (!editor) return null;

  return (
    <div
      ref={editorContainerRef}
      className={cn(
        'relative rounded-md border border-border bg-background',
        className,
      )}
    >
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
          {/* Text formatting */}
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            tooltip="Bold (Ctrl+B)"
          >
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            tooltip="Italic (Ctrl+I)"
          >
            <ItalicIcon />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            tooltip="Underline (Ctrl+U)"
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

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Headings */}
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

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Lists */}
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

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Alignment */}
          <ToolbarButton
            active={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            tooltip="Align left"
          >
            <AlignLeftIcon />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            tooltip="Align center"
          >
            <AlignCenterIcon />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            tooltip="Align right"
          >
            <AlignRightIcon />
          </ToolbarButton>

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Transliteration controls */}
          <TransliterationToolbar />
        </div>
      )}

      {/* Editor content */}
      <div className="relative px-4 py-3">
        <EditorContent editor={editor} />

        {/* Suggestion popover */}
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

      {/* Status bar */}
      {editable && (
        <div className="flex items-center justify-between border-t border-border px-3 py-1 text-[11px] text-foreground/50">
          <span>
            {editor.storage.characterCount?.characters?.() ??
              editor.getText().length}{' '}
            characters
          </span>
          {enabled && (
            <span className="flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              Transliteration active
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// --- Toolbar button helper ---

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
          'size-7 p-0 text-xs',
          active && 'bg-secondary text-primary',
        )}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

// --- Inline SVG icons ---

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
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
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
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text x="3" y="7" fontSize="6" fill="currentColor" stroke="none">
        1
      </text>
      <text x="3" y="13" fontSize="6" fill="currentColor" stroke="none">
        2
      </text>
      <text x="3" y="19" fontSize="6" fill="currentColor" stroke="none">
        3
      </text>
    </svg>
  );
}

function AlignLeftIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="18" y2="18" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="9" y1="12" x2="21" y2="12" />
      <line x1="6" y1="18" x2="21" y2="18" />
    </svg>
  );
}
