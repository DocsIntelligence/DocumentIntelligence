import type { ReactNode } from 'react';
import { isStampPaper, pageProfiles, type PageSizeKey } from './page-sizes';

interface StampPaperFrameProps {
  pageSize: PageSizeKey;
  /** Visible only in preview mode — a soft outline of the reserved zone. */
  showGuide?: boolean;
  children: ReactNode;
}

/**
 * Visual hint of the reserved top zone for stamp paper variants. The
 * actual padding is applied inside <Page>. This component only overlays a
 * dashed outline in screen mode so authors see where the stamp will be.
 */
export function StampPaperFrame({
  pageSize,
  showGuide = true,
  children,
}: StampPaperFrameProps) {
  if (!isStampPaper(pageSize) || !showGuide) return <>{children}</>;
  const p = pageProfiles[pageSize];

  return (
    <>
      <style>{`
        @media print { .stamp-zone-guide { display: none; } }
      `}</style>
      {children}
      <div
        className="stamp-zone-guide"
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${p.reservedTopMm}mm`,
          border: '1px dashed #d4d4d8',
          background:
            'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.025) 8px, rgba(0,0,0,0.025) 16px)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            left: 6,
            fontSize: '9pt',
            color: '#a1a1aa',
          }}
        >
          Reserved for pre-printed stamp (
          {pageSize.replace('stamp_paper_in_', '₹')})
        </div>
      </div>
    </>
  );
}
