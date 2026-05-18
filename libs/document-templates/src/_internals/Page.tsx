import type { CSSProperties, ReactNode } from 'react';
import { pageProfiles, type PageSizeKey } from './page-sizes';

interface PageProps {
  pageSize: PageSizeKey;
  pageNumber?: number;
  totalPages?: number;
  isFirst?: boolean;
  children: ReactNode;
}

/**
 * A single page. Outer dimensions are set in mm via inline style so the
 * paged renderer (Puppeteer with preferCSSPageSize) and the on-screen
 * preview agree on physical size.
 *
 * The `isFirst` page on stamp-paper variants applies the reserved top
 * zone; subsequent pages do not (the stamp only sits on page 1).
 */
export function Page({
  pageSize,
  pageNumber,
  totalPages,
  isFirst = true,
  children,
}: PageProps) {
  const p = pageProfiles[pageSize];
  const reservedTop = isFirst ? p.reservedTopMm : 0;

  const style: CSSProperties = {
    width: `${p.widthMm}mm`,
    height: `${p.heightMm}mm`,
    boxSizing: 'border-box',
    paddingTop: `${reservedTop + p.marginTopMm}mm`,
    paddingRight: `${p.marginRightMm}mm`,
    paddingBottom: `${p.marginBottomMm}mm`,
    paddingLeft: `${p.marginLeftMm}mm`,
    position: 'relative',
    overflow: 'hidden',
    background: '#ffffff',
    color: '#111',
    pageBreakAfter: 'always',
    breakAfter: 'page',
  };

  return (
    <section className="doc-page" data-page-size={pageSize} style={style}>
      {children}
      {pageNumber != null && totalPages != null && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: `${p.marginBottomMm / 2}mm`,
            right: `${p.marginRightMm}mm`,
            fontSize: '9pt',
            color: '#666',
          }}
        >
          Page {pageNumber} of {totalPages}
        </div>
      )}
    </section>
  );
}

/**
 * Print stylesheet to inject once per document. Set CSS `@page` size to
 * match the chosen profile. Puppeteer respects this when
 * `preferCSSPageSize: true`.
 */
export function PagePrintStyles({ pageSize }: { pageSize: PageSizeKey }) {
  const p = pageProfiles[pageSize];
  const css = `
    @page { size: ${p.widthMm}mm ${p.heightMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #f4f4f5; }
    .doc-page { margin: 0 auto 8mm; box-shadow: 0 0 0 1px #e4e4e7, 0 6px 18px -10px rgba(0,0,0,0.18); }
    @media print {
      html, body { background: #fff; }
      .doc-page { box-shadow: none; margin: 0; }
    }
    .doc-page * { line-height: 1.5; font-family: "Inter", "Segoe UI", system-ui, sans-serif; }
    .doc-page p { margin: 0 0 6pt; text-align: justify; font-size: 11pt; }
    .doc-page h1 { font-size: 16pt; text-align: center; margin: 0 0 12pt; letter-spacing: 0.03em; text-transform: uppercase; }
    .doc-page h2 { font-size: 12pt; margin: 12pt 0 4pt; text-decoration: underline; }
    .doc-page table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
    .doc-page td, .doc-page th { padding: 3pt 4pt; vertical-align: top; }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
