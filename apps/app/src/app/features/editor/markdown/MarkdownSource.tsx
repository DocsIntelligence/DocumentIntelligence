import {
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { Separator, Tooltip } from '@org/ui';
import { cn } from '@org/utils';
import {
  STARTER_TABLE,
  insertBlock,
  insertImage,
  insertLink,
  prefixLines,
  wrapSelection,
  type TextSelection,
  type TransformResult,
} from './markdown';

export interface MarkdownSourceProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  /** Optional save shortcut (Ctrl/Cmd+S). */
  onSave?: () => void;
}

/**
 * The Markdown authoring surface — a formatting toolbar over a raw-source
 * textarea — shared by the standalone scratchpad and the full editor shell
 * (`TemplateEditor` in `editorKind="markdown"`). It owns only the source text +
 * caret; preview/persistence/header live in whatever renders it.
 */
export function MarkdownSource({
  value,
  onChange,
  placeholder = 'Start writing in Markdown…',
  className,
  onSave,
}: MarkdownSourceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Selection to restore after the controlled value commits — setting it
  // synchronously races React and the browser clamps the caret to 0.
  const pendingSel = useRef<{ start: number; end: number } | null>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el && pendingSel.current) {
      const { start, end } = pendingSel.current;
      pendingSel.current = null;
      el.focus();
      el.setSelectionRange(start, end);
    }
  }, [value]);

  const applyTransform = useCallback(
    (fn: (sel: TextSelection) => TransformResult) => {
      const el = textareaRef.current;
      if (!el) return;
      const result = fn({
        value,
        start: el.selectionStart,
        end: el.selectionEnd,
      });
      pendingSel.current = { start: result.start, end: result.end };
      onChange(result.value);
    },
    [value, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        applyTransform((s) => wrapSelection(s, '**', '**', 'bold text'));
      } else if (key === 'i') {
        e.preventDefault();
        applyTransform((s) => wrapSelection(s, '*', '*', 'italic text'));
      } else if (key === 'k') {
        e.preventDefault();
        applyTransform((s) => insertLink(s));
      } else if (key === 's' && onSave) {
        e.preventDefault();
        onSave();
      }
    },
    [applyTransform, onSave],
  );

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <Toolbar applyTransform={applyTransform} />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck
        className="min-h-0 flex-1 resize-none bg-background px-5 py-4 font-mono text-[13px] leading-relaxed text-foreground/90 outline-none placeholder:text-foreground/30"
      />
    </div>
  );
}

function Toolbar({
  applyTransform,
}: {
  applyTransform: (fn: (sel: TextSelection) => TransformResult) => void;
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-0.5 border-b border-border bg-background px-2 py-1.5">
      <TBtn
        tooltip="Bold (Ctrl+B)"
        onClick={() =>
          applyTransform((s) => wrapSelection(s, '**', '**', 'bold text'))
        }
      >
        <span className="font-bold">B</span>
      </TBtn>
      <TBtn
        tooltip="Italic (Ctrl+I)"
        onClick={() =>
          applyTransform((s) => wrapSelection(s, '*', '*', 'italic text'))
        }
      >
        <span className="italic">I</span>
      </TBtn>
      <TBtn
        tooltip="Strikethrough"
        onClick={() =>
          applyTransform((s) => wrapSelection(s, '~~', '~~', 'struck text'))
        }
      >
        <span className="line-through">S</span>
      </TBtn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {([1, 2, 3] as const).map((level) => (
        <TBtn
          key={level}
          tooltip={`Heading ${level}`}
          onClick={() =>
            applyTransform((s) => prefixLines(s, () => `${'#'.repeat(level)} `))
          }
        >
          H{level}
        </TBtn>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TBtn
        tooltip="Bullet list"
        onClick={() => applyTransform((s) => prefixLines(s, () => '- '))}
      >
        <BulletIcon />
      </TBtn>
      <TBtn
        tooltip="Numbered list"
        onClick={() =>
          applyTransform((s) => prefixLines(s, (i) => `${i + 1}. `))
        }
      >
        <OrderedIcon />
      </TBtn>
      <TBtn
        tooltip="Quote"
        onClick={() => applyTransform((s) => prefixLines(s, () => '> '))}
      >
        <QuoteIcon />
      </TBtn>
      <TBtn
        tooltip="Task list"
        onClick={() => applyTransform((s) => prefixLines(s, () => '- [ ] '))}
      >
        <TaskIcon />
      </TBtn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TBtn
        tooltip="Inline code"
        onClick={() => applyTransform((s) => wrapSelection(s, '`', '`', 'code'))}
      >
        <CodeIcon />
      </TBtn>
      <TBtn
        tooltip="Code block"
        onClick={() =>
          applyTransform((s) => wrapSelection(s, '```\n', '\n```', 'code'))
        }
      >
        <CodeBlockIcon />
      </TBtn>
      <TBtn tooltip="Link (Ctrl+K)" onClick={() => applyTransform(insertLink)}>
        <LinkIcon />
      </TBtn>
      <TBtn tooltip="Image" onClick={() => applyTransform((s) => insertImage(s))}>
        <ImageIcon />
      </TBtn>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <TBtn
        tooltip="Insert table"
        onClick={() => applyTransform((s) => insertBlock(s, STARTER_TABLE))}
      >
        <TableIcon />
      </TBtn>
      <TBtn
        tooltip="Divider"
        onClick={() => applyTransform((s) => insertBlock(s, '---'))}
      >
        <DividerIcon />
      </TBtn>
    </div>
  );
}

function TBtn({
  tooltip,
  onClick,
  children,
}: {
  tooltip: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm text-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
      >
        {children}
      </button>
    </Tooltip>
  );
}

// ─── Icons (16px, currentColor) ──────────────────────────────────────────────

const svg = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const BulletIcon = () =>
  svg(
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="3.5" cy="6" r="1" fill="currentColor" />
      <circle cx="3.5" cy="12" r="1" fill="currentColor" />
      <circle cx="3.5" cy="18" r="1" fill="currentColor" />
    </>,
  );
const OrderedIcon = () =>
  svg(
    <>
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4M4 10h2" />
      <path d="M6 16a1 1 0 1 0-2 0M4 18h2l-2 2h2" />
    </>,
  );
const QuoteIcon = () =>
  svg(
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2-2-2H4c-1.25 0-2 .75-2 2v4c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />,
  );
const TaskIcon = () =>
  svg(
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <path d="m5 7 1.5 1.5L9 5.5" />
      <line x1="14" y1="6" x2="21" y2="6" />
      <line x1="14" y1="14" x2="21" y2="14" />
      <line x1="3" y1="14" x2="11" y2="14" />
    </>,
  );
const CodeIcon = () =>
  svg(
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>,
  );
const CodeBlockIcon = () =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m9 10-2 2 2 2M15 10l2 2-2 2" />
    </>,
  );
const LinkIcon = () =>
  svg(
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>,
  );
const ImageIcon = () =>
  svg(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L5 21" />
    </>,
  );
const TableIcon = () =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </>,
  );
const DividerIcon = () =>
  svg(
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
    </>,
  );
