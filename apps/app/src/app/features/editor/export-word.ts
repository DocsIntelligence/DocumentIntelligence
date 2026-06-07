/**
 * Client-side Word export. The editor already holds the document HTML +
 * placeholder values, so a Word-openable document is just a wrapped HTML
 * string downloaded as a Blob — no backend, no S3, instant. (PDF stays on the
 * backend Puppeteer service, which is reliable; browser print is not.)
 *
 * This produces an HTML-based `.doc` (`application/msword`) that Word and
 * LibreOffice open and edit natively. A true OOXML `.docx` would need a
 * converter; this is the pragmatic, dependency-free path.
 */
export function downloadWordDoc(opts: {
  filename: string;
  title: string;
  html: string;
  values: Record<string, string>;
}): void {
  const body = prepareBody(opts.html, opts.values);
  const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.title)}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #111; }
  h1 { font-size: 16pt; text-align: center; text-transform: uppercase; }
  h2 { font-size: 13pt; text-decoration: underline; }
  h3 { font-size: 12pt; }
  p { margin: 0 0 8pt; text-align: justify; }
  ul, ol { margin: 0 0 8pt 24pt; }
</style>
</head>
<body>${body}</body>
</html>`;

  const blob = new Blob([doc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(opts.filename)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

function prepareBody(html: string, values: Record<string, string>): string {
  // Editor page-break markers → Word page breaks.
  const withBreaks = html.replace(
    /<div[^>]*data-page-break[^>]*>[\s\S]*?<\/div>/gi,
    '<br style="page-break-before:always" />',
  );
  // Fill {{placeholders}}; leave a visible [key] for any still empty.
  return withBreaks.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_full, key: string) => {
      const v = values[key];
      return v && v.trim() ? escapeHtml(v) : `[${escapeHtml(key)}]`;
    },
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'document'
  );
}
