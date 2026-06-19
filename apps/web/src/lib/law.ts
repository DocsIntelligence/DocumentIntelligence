import { WEB_ENV } from '../config';

/**
 * Server-side data layer for the public `/law` catalog. Lives in `apps/web`
 * (Next.js) so the same data the SPA renders for logged-in users is fetched
 * server-side here for SEO + share-link previews.
 *
 * Talks to the API's `@Public()` `/public/law` endpoints — no auth cookie
 * needed, which is intentional: the catalog is the marketing surface.
 */

export interface PublicCitation {
  id: string;
  act: string;
  actShort?: string;
  section?: string;
  title: string;
  summary: string;
  effectiveFrom?: string;
  supersedes?: string;
  confidence: 'high' | 'moderate' | 'low';
  verifyNote?: string;
  topics?: string[];
  appliesTo?: string[];
  commonlyPairedWith?: string[];
  draftingTips?: string;
  externalUrl?: string;
  jurisdiction?: string;
}

const FETCH_OPTS: RequestInit = {
  // Static + ISR: revalidate every 5 minutes. Catalog changes are admin-driven
  // and infrequent; the API itself caches the resolved list for 60 s. Net:
  // pages serve cached HTML, refresh in the background.
  next: { revalidate: 300 },
  headers: { Accept: 'application/json' },
};

export async function fetchPublicCitations(): Promise<PublicCitation[]> {
  try {
    const res = await fetch(`${WEB_ENV.apiUrl}/public/law`, FETCH_OPTS);
    if (!res.ok) return [];
    return (await res.json()) as PublicCitation[];
  } catch {
    return [];
  }
}

export async function fetchPublicCitation(id: string): Promise<PublicCitation | null> {
  try {
    const res = await fetch(
      `${WEB_ENV.apiUrl}/public/law/${encodeURIComponent(id)}`,
      FETCH_OPTS,
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicCitation;
  } catch {
    return null;
  }
}

export interface PublicCitationAttachment {
  id: string;
  kind: string;
  title: string;
  filename: string;
  contentType: string;
  byteSize: number | null;
  /** Resolved download URL (presigned S3 or public local-fs stream). */
  url: string;
}

/**
 * Public downloadable files attached to a citation (bare-act PDFs, commentary,
 * judgments). The API already filters to public files of a public citation, so
 * a private citation just yields []. Failures degrade to [] — the section hides
 * rather than breaking the page.
 */
export async function fetchPublicCitationAttachments(
  id: string,
): Promise<PublicCitationAttachment[]> {
  try {
    const res = await fetch(
      `${WEB_ENV.apiUrl}/public/law/${encodeURIComponent(id)}/attachments`,
      FETCH_OPTS,
    );
    if (!res.ok) return [];
    return (await res.json()) as PublicCitationAttachment[];
  } catch {
    return [];
  }
}

/** Build the canonical `/law/:id` slug from a citation id. */
export function citationSlug(id: string): string {
  return id.replace(/\./g, '-');
}

/** Reverse — canonical slug back to citation id. */
export function slugToId(slug: string): string {
  return slug.replace(/-/g, '.');
}
