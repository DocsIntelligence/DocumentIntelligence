import {
  Children,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Page } from './Page';
import { pageProfiles, type PageSizeKey } from './page-sizes';

interface PaginatorProps {
  pageSize: PageSizeKey;
  children: ReactNode;
  /** Header element repeated above content from page 2 onward. */
  continuedHeader?: ReactNode;
}

/**
 * Block-level paginator. Renders children offscreen, measures each block's
 * rendered height, then redistributes them into <Page> containers so each
 * page never overflows.
 *
 * Constraints:
 *   - Pass only top-level *block* children (sections, paragraphs, tables).
 *   - Atomic blocks are not split mid-element — if a single block exceeds
 *     a page, it overflows. Authors should compose with that in mind.
 *
 * Measurement strategy: a hidden mirror div is rendered with the same width
 * (mm) as a content area; we read children's offsetHeight after layout.
 */
export function Paginator({
  pageSize,
  children,
  continuedHeader,
}: PaginatorProps) {
  const profile = pageProfiles[pageSize];
  const childArray = Children.toArray(children);

  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<ReactNode[][]>([childArray]);

  // useLayoutEffect avoids a paint with the wrong layout when running in
  // the browser; the typeof check keeps SSR happy.
  const useIsomorphicLayoutEffect =
    typeof window === 'undefined' ? useEffect : useLayoutEffect;

  useIsomorphicLayoutEffect(() => {
    if (!mirrorRef.current) return;
    const blocks = Array.from(
      mirrorRef.current.children,
    ) as HTMLElement[];

    // Convert mm to px assuming 96dpi (1mm ≈ 3.7795px); browsers do the same
    // when interpreting mm on screen.
    const mmToPx = (mm: number) => (mm * 96) / 25.4;

    const contentHeightFirst = mmToPx(
      profile.heightMm -
        profile.reservedTopMm -
        profile.marginTopMm -
        profile.marginBottomMm,
    );
    const contentHeightRest = mmToPx(
      profile.heightMm - profile.marginTopMm - profile.marginBottomMm,
    );

    const result: ReactNode[][] = [];
    let bucket: ReactNode[] = [];
    let used = 0;
    let capacity = contentHeightFirst;

    blocks.forEach((el, i) => {
      const h = el.offsetHeight;
      if (used + h > capacity && bucket.length > 0) {
        result.push(bucket);
        bucket = [];
        used = 0;
        capacity = contentHeightRest;
      }
      bucket.push(childArray[i]);
      used += h;
    });
    if (bucket.length) result.push(bucket);

    setPages(result.length ? result : [[]]);
  }, [children, pageSize]);

  return (
    <>
      {/* Hidden mirror — same width as a page's content area. */}
      <div
        ref={mirrorRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          width: `${
            profile.widthMm - profile.marginLeftMm - profile.marginRightMm
          }mm`,
          visibility: 'hidden',
        }}
      >
        {childArray}
      </div>

      {pages.map((blocks, i) => (
        <Page
          key={i}
          pageSize={pageSize}
          isFirst={i === 0}
          pageNumber={i + 1}
          totalPages={pages.length}
        >
          {i > 0 && continuedHeader}
          {blocks}
        </Page>
      ))}
    </>
  );
}
