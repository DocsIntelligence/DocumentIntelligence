import type { Editor } from '@tiptap/react';
import { Button, Separator, Tooltip, TransliterationToolbar } from '@org/ui';
import { cn } from '@org/utils';
import { useTranslation } from 'react-i18next';

export type EditorToolbarProps = {
  editor: Editor;
  onInsertPlaceholder?: () => void;
  onInsertPageBreak?: () => void;
};

export function EditorToolbar({
  editor,
  onInsertPlaceholder,
  onInsertPageBreak,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-background px-2 py-1.5">
      <Btn
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        tooltip={t('editor.format.bold', 'Bold (Ctrl+B)')}
      >
        <BoldIcon />
      </Btn>
      <Btn
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        tooltip={t('editor.format.italic', 'Italic (Ctrl+I)')}
      >
        <ItalicIcon />
      </Btn>
      <Btn
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        tooltip={t('editor.format.underline', 'Underline (Ctrl+U)')}
      >
        <UnderlineIcon />
      </Btn>
      <Btn
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        tooltip={t('editor.format.strikethrough', 'Strikethrough')}
      >
        <StrikeIcon />
      </Btn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Btn
        active={editor.isActive('heading', { level: 1 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 1 }).run()
        }
        tooltip={t('editor.format.heading1', 'Heading 1')}
      >
        H1
      </Btn>
      <Btn
        active={editor.isActive('heading', { level: 2 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 2 }).run()
        }
        tooltip={t('editor.format.heading2', 'Heading 2')}
      >
        H2
      </Btn>
      <Btn
        active={editor.isActive('heading', { level: 3 })}
        onClick={() =>
          editor.chain().focus().toggleHeading({ level: 3 }).run()
        }
        tooltip={t('editor.format.heading3', 'Heading 3')}
      >
        H3
      </Btn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Btn
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        tooltip={t('editor.format.bulletList', 'Bullet list')}
      >
        <ListIcon />
      </Btn>
      <Btn
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        tooltip={t('editor.format.numberedList', 'Numbered list')}
      >
        <OrderedListIcon />
      </Btn>
      <Btn
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        tooltip={t('editor.format.quote', 'Quote')}
      >
        <QuoteIcon />
      </Btn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Btn
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        tooltip={t('editor.format.alignLeft', 'Align left')}
      >
        <AlignLeftIcon />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        tooltip={t('editor.format.alignCenter', 'Align center')}
      >
        <AlignCenterIcon />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        tooltip={t('editor.format.alignRight', 'Align right')}
      >
        <AlignRightIcon />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        tooltip={t('editor.format.justify', 'Justify')}
      >
        <AlignJustifyIcon />
      </Btn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Btn
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        tooltip={t('editor.format.highlight', 'Highlight')}
      >
        <HighlightIcon />
      </Btn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {onInsertPlaceholder && (
        <Tooltip content={t('editor.format.insertPlaceholder', 'Insert placeholder token')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onInsertPlaceholder}
            className="h-7 gap-1 px-1.5 text-[11px] font-medium"
          >
            <span className="font-mono">{'{{'}</span>
            {t('editor.format.field', 'Field')}
          </Button>
        </Tooltip>
      )}
      {onInsertPageBreak && (
        <Tooltip content={t('editor.format.insertPageBreak', 'Insert page break (Ctrl+Enter)')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onInsertPageBreak}
            className="h-7 gap-1 px-1.5 text-[11px] font-medium"
          >
            <PageBreakIcon />
            {t('editor.format.pageBreak', 'Page Break')}
          </Button>
        </Tooltip>
      )}

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TransliterationToolbar />

      <div className="ml-auto flex items-center gap-1">
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          tooltip={t('editor.format.undo', 'Undo')}
          disabled={!editor.can().undo()}
        >
          <UndoIcon />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          tooltip={t('editor.format.redo', 'Redo')}
          disabled={!editor.can().redo()}
        >
          <RedoIcon />
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  active,
  onClick,
  tooltip,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  tooltip: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={tooltip}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'size-7 p-0 text-xs font-medium',
          active && 'bg-primary/10 text-primary',
        )}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

// --- Inline icons ---
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
      <text x="4" y="8" fontSize="7" fill="currentColor" stroke="none">
        1
      </text>
      <text x="4" y="14" fontSize="7" fill="currentColor" stroke="none">
        2
      </text>
      <text x="4" y="20" fontSize="7" fill="currentColor" stroke="none">
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
function AlignJustifyIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function PageBreakIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 4h16v6H4z" />
      <path d="M4 14h16v6H4z" />
      <path d="M2 12h4M9 12h2M14 12h2M19 12h3" strokeDasharray="2 2" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
    </svg>
  );
}
function RedoIcon() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 15-6.7L21 13" />
    </svg>
  );
}
