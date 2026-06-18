import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import type { ResolvedProfile } from './estate-profile.service';

/** Where in the asset a query matched (drives the badge in the UI). */
export type VaultSearchMatch = 'asset' | 'document' | 'analysis';

export interface VaultSearchHit {
  assetId: string;
  label: string;
  type: string;
  institution: string | null;
  status: string;
  value: number | null;
  currency: string;
  /** Strongest place the query matched (asset > document > analysis). */
  matchedIn: VaultSearchMatch;
  /** A short text window around the match, for context under the title. */
  snippet: string;
}

const SNIPPET_RADIUS = 90; // chars on each side of the match
const minorToMajor = (m: bigint | null) =>
  m == null ? null : Number(m) / 100;

/**
 * Vault-scoped full-text search (docs/13). Unlike the global drafting search,
 * this stays inside ONE estate profile and matches across an asset's own fields,
 * the cached text of every attached document, and the AI analysis summaries —
 * then returns the matching assets (the UI links each hit to its detail page).
 */
@Injectable()
export class EstateSearchService {
  constructor(private readonly db: DatabaseService) {}

  async search(
    profile: ResolvedProfile,
    q: string,
    limit = 20,
  ): Promise<{ items: VaultSearchHit[]; total: number }> {
    const needle = q.trim().toLowerCase();
    if (!needle) return { items: [], total: 0 };

    // Best match wins per asset; rank asset-field > document > analysis.
    const hits = new Map<string, VaultSearchHit>();
    const rank: Record<VaultSearchMatch, number> = {
      asset: 3,
      document: 2,
      analysis: 1,
    };
    const consider = (
      assetId: string,
      matchedIn: VaultSearchMatch,
      snippet: string,
      meta: Omit<VaultSearchHit, 'matchedIn' | 'snippet'>,
    ) => {
      const existing = hits.get(assetId);
      if (existing && rank[existing.matchedIn] >= rank[matchedIn]) return;
      hits.set(assetId, { ...meta, matchedIn, snippet });
    };

    // All active assets in this profile (personal-vault scale — dozens, not millions).
    const assets = await this.db.asset.findMany({
      where: { profileId: profile.id, isActive: true },
      select: {
        id: true,
        label: true,
        type: true,
        institution: true,
        status: true,
        currency: true,
        currentValueMinor: true,
        details: true,
      },
    });
    const metaById = new Map<string, Omit<VaultSearchHit, 'matchedIn' | 'snippet'>>();
    for (const a of assets) {
      const meta = {
        assetId: a.id,
        label: a.label,
        type: a.type,
        institution: a.institution,
        status: a.status,
        currency: a.currency,
        value: minorToMajor(a.currentValueMinor),
      };
      metaById.set(a.id, meta);

      // Asset-field match: label, institution, or any per-type detail scalar.
      const fieldText = [a.label, a.institution ?? '', collectScalars(a.details).join(' ')]
        .join('  ')
        .trim();
      const snip = snippet(fieldText, needle);
      if (snip) consider(a.id, 'asset', snip, meta);
    }

    const assetIds = [...metaById.keys()];
    if (assetIds.length === 0) return { items: [], total: 0 };

    // Document text + filename matches.
    const docs = await this.db.assetDocument.findMany({
      where: { assetId: { in: assetIds } },
      select: { id: true, assetId: true, filename: true, searchText: true },
    });
    const docToAsset = new Map<string, string>();
    for (const d of docs) {
      if (!d.assetId) continue;
      docToAsset.set(d.id, d.assetId);
      const meta = metaById.get(d.assetId);
      if (!meta) continue;
      const body = [d.filename ?? '', d.searchText ?? ''].join('\n');
      const snip = snippet(body, needle);
      if (snip) consider(d.assetId, 'document', snip, meta);
    }

    // AI analysis summary matches (latest runs are fine — we only need the text).
    const docIds = [...docToAsset.keys()];
    if (docIds.length > 0) {
      const analyses = await this.db.analysisRun.findMany({
        where: {
          subjectType: 'asset_document',
          subjectId: { in: docIds },
          summary: { contains: q, mode: 'insensitive' },
        },
        select: { subjectId: true, summary: true },
      });
      for (const a of analyses) {
        const assetId = a.subjectId ? docToAsset.get(a.subjectId) : undefined;
        if (!assetId) continue;
        const meta = metaById.get(assetId);
        if (!meta) continue;
        const snip = snippet(a.summary ?? '', needle);
        if (snip) consider(assetId, 'analysis', snip, meta);
      }
    }

    const items = [...hits.values()]
      .sort((x, y) => rank[y.matchedIn] - rank[x.matchedIn] || x.label.localeCompare(y.label))
      .slice(0, limit);
    return { items, total: hits.size };
  }
}

/** Pull every string/number/boolean leaf out of a Prisma JSON value. */
function collectScalars(value: Prisma.JsonValue | null | undefined): string[] {
  if (value == null) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.flatMap((v) => collectScalars(v));
  return Object.values(value).flatMap((v) => collectScalars(v));
}

/** A short context window around the first (case-insensitive) match, or null. */
function snippet(text: string, needle: string): string | null {
  if (!text) return null;
  const idx = text.toLowerCase().indexOf(needle);
  if (idx < 0) return null;
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(text.length, idx + needle.length + SNIPPET_RADIUS);
  let out = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) out = `…${out}`;
  if (end < text.length) out = `${out}…`;
  return out;
}
