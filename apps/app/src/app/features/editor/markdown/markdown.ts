/**
 * A small, dependency-free Markdown to HTML renderer for the in-app Markdown
 * editor's live preview. We deliberately avoid pulling a parser dependency:
 * this covers the CommonMark subset the editor's toolbar can produce
 * (headings, bold/italic/strike, inline + fenced code, blockquotes, ordered /
 * unordered lists, links, images, horizontal rules, paragraphs) and escapes
 * all raw HTML so user input can never inject markup into the preview.
 *
 * The same HTML is persisted alongside the Markdown source so a Markdown
 * document round-trips through the existing freeform draft / PDF / share
 * pipeline (which all read `data.html`). The Markdown string stays the source
 * of truth (`data.markdown`, `data.format = 'markdown'`).
 */

/** Private-use sentinels used to stash inline-code spans during formatting. */
const CODE_OPEN = '';
const CODE_CLOSE = '';
const CODE_RESTORE = /(\d+)/g;

/** Escape HTML special chars so source text never becomes live markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Render inline spans: code, bold, italic, strike, links, images. */
function renderInline(raw: string): string {
  let s = escapeHtml(raw);

  // Spans we stash behind sentinels so later formatting passes leave them
  // alone (inline code + backslash-escaped literals), restored at the very end.
  const stash: string[] = [];
  const keep = (html: string) => `${CODE_OPEN}${stash.push(html) - 1}${CODE_CLOSE}`;

  // Backslash escapes: \* \_ \` \# … render the literal char, not markup.
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, (_m, ch: string) => keep(ch));

  // Inline code next — its contents must not be re-processed.
  s = s.replace(/`([^`]+)`/g, (_m, code: string) => keep(`<code>${code}</code>`));

  // Images: ![alt](src) — before links (shares the bracket syntax).
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_m, alt: string, src: string) => `<img src="${src}" alt="${alt}" />`,
  );

  // Links: [text](href)
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_m, text: string, href: string) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  );

  // Autolink bare URLs (not already inside an href="…").
  s = s.replace(
    /(^|[^"=>])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g,
    (_m, pre: string, url: string) =>
      `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );

  // Bold+italic, then bold, then italic (most-specific markers first).
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  // Strikethrough
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // Restore stashed code / escaped-literal placeholders.
  s = s.replace(CODE_RESTORE, (_m, i: string) => stash[Number(i)]);

  return s;
}

/** Split a GFM table row into trimmed cells (tolerates optional edge pipes). */
function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/** A GFM table delimiter row: every cell is dashes with optional `:` aligners. */
function isTableDelimiter(line: string): boolean {
  if (!/[-]/.test(line) || !line.includes('|')) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** Map a delimiter cell to its CSS text-align (`undefined` = default/left). */
function alignOf(cell: string): string | undefined {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return undefined;
}

/**
 * Render a Markdown string to an HTML string. Block-level parsing is a single
 * line-oriented pass; inline formatting is applied per text line.
 */
export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  let i = 0;
  // Track the kind of list we're inside so consecutive items group correctly.
  let listType: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ``` ... ```
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      closeList();
      const lang = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      const cls = lang ? ` class="language-${lang}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    // Blank line — closes any open list, no output.
    if (/^\s*$/.test(line)) {
      closeList();
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeList();
      out.push('<hr />');
      i++;
      continue;
    }

    // Heading: # .. ######
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote (collect consecutive `>` lines)
    if (/^\s*>\s?/.test(line)) {
      closeList();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderInline(quote.join(' '))}</blockquote>`);
      continue;
    }

    // GFM table: a header row with `|`, followed by a delimiter row.
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableDelimiter(lines[i + 1]) &&
      !isTableDelimiter(line)
    ) {
      closeList();
      const headers = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map(alignOf);
      i += 2; // consume header + delimiter

      const cell = (tag: 'th' | 'td', text: string, idx: number) => {
        const align = aligns[idx];
        const style = align ? ` style="text-align:${align}"` : '';
        return `<${tag}${style}>${renderInline(text)}</${tag}>`;
      };

      const head = `<thead><tr>${headers
        .map((h, idx) => cell('th', h, idx))
        .join('')}</tr></thead>`;

      const bodyRows: string[] = [];
      while (
        i < lines.length &&
        lines[i].includes('|') &&
        !/^\s*$/.test(lines[i])
      ) {
        const cells = splitTableRow(lines[i]);
        bodyRows.push(
          `<tr>${headers
            .map((_h, idx) => cell('td', cells[idx] ?? '', idx))
            .join('')}</tr>`,
        );
        i++;
      }
      const body = bodyRows.length ? `<tbody>${bodyRows.join('')}</tbody>` : '';
      out.push(`<table>${head}${body}</table>`);
      continue;
    }

    // Unordered list item (incl. GFM task list: `- [ ]` / `- [x]`)
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      const task = ul[1].match(/^\[([ xX])\]\s+(.*)$/);
      if (task) {
        const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
        out.push(
          `<li data-task><input type="checkbox" disabled${checked} /> ${renderInline(task[2])}</li>`,
        );
      } else {
        out.push(`<li>${renderInline(ul[1])}</li>`);
      }
      i++;
      continue;
    }

    // Ordered list item
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${renderInline(ol[1])}</li>`);
      i++;
      continue;
    }

    // Paragraph — gather consecutive plain lines into one block.
    closeList();
    const para: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*(?:#{1,6}\s|>|[-*+]\s|\d+\.\s|```)/.test(lines[i]) &&
      !/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(para.join('\n')).replace(/\n/g, '<br />')}</p>`);
  }

  closeList();
  return out.join('\n');
}

/**
 * Convert an HTML string back to Markdown — the inverse of `renderMarkdown`,
 * used when an HTML-producing source (the AI draft/revise endpoints, or a
 * gallery template) feeds the Markdown editor, whose source of truth is the
 * Markdown text. Covers the same element subset `renderMarkdown` emits; unknown
 * elements fall through to their text content. Browser-only (uses DOMParser).
 */
export function htmlToMarkdown(html: string): string {
  if (typeof document === 'undefined' || !html) return html ?? '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return convertBlocks(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Inline conversion for the children of a block element. */
function convertInline(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += (child.textContent ?? '').replace(/\s+/g, ' ');
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = convertInline(el);
    switch (tag) {
      case 'strong':
      case 'b':
        out += `**${inner}**`;
        break;
      case 'em':
      case 'i':
        out += `*${inner}*`;
        break;
      case 'del':
      case 's':
      case 'strike':
        out += `~~${inner}~~`;
        break;
      case 'code':
        out += `\`${el.textContent ?? ''}\``;
        break;
      case 'br':
        out += '\n';
        break;
      case 'a':
        out += `[${inner}](${el.getAttribute('href') ?? ''})`;
        break;
      case 'img':
        out += `![${el.getAttribute('alt') ?? ''}](${el.getAttribute('src') ?? ''})`;
        break;
      default:
        out += inner;
    }
  });
  return out;
}

/** Block-level conversion, walking an element's block children. */
function convertBlocks(root: Node): string {
  const parts: string[] = [];
  root.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').trim();
      if (text) parts.push(text);
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      parts.push(`${'#'.repeat(Number(tag[1]))} ${convertInline(el)}`);
    } else if (tag === 'p') {
      parts.push(convertInline(el));
    } else if (tag === 'blockquote') {
      const inner = convertBlocks(el)
        .split('\n')
        .map((l) => `> ${l}`.trimEnd())
        .join('\n');
      parts.push(inner);
    } else if (tag === 'ul' || tag === 'ol') {
      parts.push(convertList(el, tag === 'ol'));
    } else if (tag === 'pre') {
      const code = el.querySelector('code');
      const langClass = code?.getAttribute('class') ?? '';
      const lang = /language-(\w+)/.exec(langClass)?.[1] ?? '';
      parts.push('```' + lang + '\n' + (el.textContent ?? '') + '\n```');
    } else if (tag === 'hr') {
      parts.push('---');
    } else if (tag === 'table') {
      parts.push(convertTable(el));
    } else if (tag === 'div' || tag === 'section' || tag === 'article') {
      parts.push(convertBlocks(el));
    } else {
      const inline = convertInline(el).trim();
      if (inline) parts.push(inline);
    }
  });
  return parts.filter(Boolean).join('\n\n');
}

function convertList(listEl: HTMLElement, ordered: boolean): string {
  const items: string[] = [];
  let n = 1;
  listEl.querySelectorAll(':scope > li').forEach((li) => {
    const marker = ordered ? `${n++}.` : '-';
    const text = convertInline(li as HTMLElement).trim();
    items.push(`${marker} ${text}`);
  });
  return items.join('\n');
}

function convertTable(tableEl: HTMLElement): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (!rows.length) return '';
  const toCells = (tr: Element) =>
    Array.from(tr.querySelectorAll('th,td')).map((c) =>
      convertInline(c as HTMLElement).trim().replace(/\|/g, '\\|'),
    );
  const header = toCells(rows[0]);
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
  ];
  for (let i = 1; i < rows.length; i++) {
    lines.push(`| ${toCells(rows[i]).join(' | ')} |`);
  }
  return lines.join('\n');
}

/** Strip Markdown syntax down to readable text — used to derive a doc title. */
export function markdownToPlainTitle(src: string): string {
  const firstLine = src
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return '';
  return firstLine
    .replace(/^#{1,6}\s+/, '')
    .replace(/[*_`~>#-]/g, '')
    .trim()
    .slice(0, 120);
}

// ─── Toolbar transforms ─────────────────────────────────────────────────────
//
// Pure helpers the editor applies to the current textarea value + selection.
// Each returns the next value and the selection to restore afterwards.

export interface TextSelection {
  value: string;
  start: number;
  end: number;
}

export interface TransformResult {
  value: string;
  start: number;
  end: number;
}

/** Wrap the current selection (or caret) with `before`/`after` markers. */
export function wrapSelection(
  sel: TextSelection,
  before: string,
  after = before,
  placeholder = '',
): TransformResult {
  const { value, start, end } = sel;
  const selected = value.slice(start, end) || placeholder;
  const next =
    value.slice(0, start) + before + selected + after + value.slice(end);
  return {
    value: next,
    start: start + before.length,
    end: start + before.length + selected.length,
  };
}

/** Prefix each line touched by the selection (headings, quotes, lists). */
export function prefixLines(
  sel: TextSelection,
  makePrefix: (index: number) => string,
): TransformResult {
  const { value, start, end } = sel;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const transformed = lines
    .map((line, idx) => makePrefix(idx) + line)
    .join('\n');
  const next = value.slice(0, lineStart) + transformed + value.slice(lineEnd);
  return {
    value: next,
    start: lineStart,
    end: lineStart + transformed.length,
  };
}

/** Insert a link, using the selection as the link text when present. */
export function insertLink(
  sel: TextSelection,
  href = 'https://',
): TransformResult {
  const { value, start, end } = sel;
  const text = value.slice(start, end) || 'link text';
  const snippet = `[${text}](${href})`;
  const next = value.slice(0, start) + snippet + value.slice(end);
  // Select the href so the user can immediately type the URL.
  const hrefStart = start + text.length + 3;
  return { value: next, start: hrefStart, end: hrefStart + href.length };
}

/** Insert an image, using the selection as the alt text when present. */
export function insertImage(
  sel: TextSelection,
  src = 'https://',
): TransformResult {
  const { value, start, end } = sel;
  const alt = value.slice(start, end) || 'alt text';
  const snippet = `![${alt}](${src})`;
  const next = value.slice(0, start) + snippet + value.slice(end);
  const srcStart = start + alt.length + 4;
  return { value: next, start: srcStart, end: srcStart + src.length };
}

/**
 * Insert a multi-line block (table, divider, …) on its own lines, padding with
 * blank lines so it parses as a standalone block, and leaving the caret at the
 * block's start.
 */
export function insertBlock(sel: TextSelection, block: string): TransformResult {
  const { value, start, end } = sel;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const snippet = lead + block + trail;
  const next = before + snippet + after;
  const caret = start + lead.length;
  return { value: next, start: caret, end: caret + block.length };
}

/** A 3-column starter table for the "insert table" toolbar action. */
export const STARTER_TABLE = [
  '| Column 1 | Column 2 | Column 3 |',
  '| --- | --- | --- |',
  '| Cell | Cell | Cell |',
  '| Cell | Cell | Cell |',
].join('\n');
