/**
 * Page-size catalogue. mm-precise. Keep this aligned with the Prisma
 * PageSize enum.
 *
 * Stamp-paper denominations share outer dimensions (typical 215×330mm
 * judicial paper) but reserve different top-zone heights for the
 * pre-printed stamp. Verify physical samples per state — these are
 * common defaults; some states issue narrower stamps.
 */

export type PageSizeKey =
  | 'a4'
  | 'legal'
  | 'foolscap'
  | 'stamp_paper_in_10'
  | 'stamp_paper_in_20'
  | 'stamp_paper_in_50'
  | 'stamp_paper_in_100'
  | 'stamp_paper_in_500';

export interface PageProfile {
  widthMm: number;
  heightMm: number;
  /** Reserved top zone (for stamp paper pre-printed area). */
  reservedTopMm: number;
  /** Inner content margins applied below reserved zone. */
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
}

export const pageProfiles: Record<PageSizeKey, PageProfile> = {
  a4: {
    widthMm: 210,
    heightMm: 297,
    reservedTopMm: 0,
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
  legal: {
    widthMm: 215.9,
    heightMm: 355.6,
    reservedTopMm: 0,
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
  foolscap: {
    widthMm: 215,
    heightMm: 330,
    reservedTopMm: 0,
    marginTopMm: 20,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
  // Indian non-judicial stamp paper. Reserved top zones are calibrated to
  // cover the printed stamp area, descending with denomination size.
  stamp_paper_in_10: {
    widthMm: 215,
    heightMm: 330,
    reservedTopMm: 70,
    marginTopMm: 10,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
  stamp_paper_in_20: {
    widthMm: 215,
    heightMm: 330,
    reservedTopMm: 75,
    marginTopMm: 10,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
  stamp_paper_in_50: {
    widthMm: 215,
    heightMm: 330,
    reservedTopMm: 85,
    marginTopMm: 10,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
  stamp_paper_in_100: {
    widthMm: 215,
    heightMm: 330,
    reservedTopMm: 90,
    marginTopMm: 10,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
  stamp_paper_in_500: {
    widthMm: 215,
    heightMm: 330,
    reservedTopMm: 95,
    marginTopMm: 10,
    marginRightMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
  },
};

export function isStampPaper(key: PageSizeKey): boolean {
  return key.startsWith('stamp_paper_');
}
