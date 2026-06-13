import { Injectable } from '@nestjs/common';
import type { SearchConfig } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

/** Effective, fully-resolved search configuration (never null fields). */
export interface EffectiveSearchConfig {
  keywordWeight: number;
  semanticWeight: number;
  semanticEnabled: boolean;
  enabledKinds: string[];
  fuzzyThreshold: number;
  recencyWeight: number;
  snippetWords: number;
  embeddingModel: string;
  maxResults: number;
}

/** Hardcoded fallback when no DB row exists at all (fresh install). Mirrors the
 *  Prisma model defaults so behaviour is identical with or without a row. */
export const SYSTEM_DEFAULT_SEARCH_CONFIG: EffectiveSearchConfig = {
  keywordWeight: 0.5,
  semanticWeight: 0.5,
  semanticEnabled: true,
  enabledKinds: ['document', 'source'],
  fuzzyThreshold: 0.3,
  recencyWeight: 0.2,
  snippetWords: 30,
  embeddingModel: 'text-embedding-3-small',
  maxResults: 200,
};

@Injectable()
export class SearchConfigService {
  constructor(private readonly db: DatabaseService) {}

  private pick(row: SearchConfig): EffectiveSearchConfig {
    return {
      keywordWeight: row.keywordWeight,
      semanticWeight: row.semanticWeight,
      semanticEnabled: row.semanticEnabled,
      enabledKinds: row.enabledKinds,
      fuzzyThreshold: row.fuzzyThreshold,
      recencyWeight: row.recencyWeight,
      snippetWords: row.snippetWords,
      embeddingModel: row.embeddingModel,
      maxResults: row.maxResults,
    };
  }

  /** Resolve the config for a request: an org row overrides the system row,
   *  which overrides hardcoded defaults. Field-level — an org row that exists
   *  fully replaces the system row (simplest, predictable). */
  async getEffective(orgId?: string | null): Promise<EffectiveSearchConfig> {
    if (orgId) {
      const orgRow = await this.db.searchConfig.findUnique({
        where: { ownerOrgId: orgId },
      });
      if (orgRow) return this.pick(orgRow);
    }
    const sys = await this.db.searchConfig.findFirst({
      where: { ownerOrgId: null },
    });
    return sys ? this.pick(sys) : { ...SYSTEM_DEFAULT_SEARCH_CONFIG };
  }

  /** Admin read: the raw row (org or system default), creating the system row
   *  on first read so the admin UI always has something to edit. */
  async getRow(orgId?: string | null): Promise<SearchConfig> {
    if (orgId) {
      const existing = await this.db.searchConfig.findUnique({
        where: { ownerOrgId: orgId },
      });
      if (existing) return existing;
      return this.db.searchConfig.create({ data: { ownerOrgId: orgId } });
    }
    const sys = await this.db.searchConfig.findFirst({
      where: { ownerOrgId: null },
    });
    if (sys) return sys;
    return this.db.searchConfig.create({ data: { ownerOrgId: null } });
  }

  /** Admin update (upsert). `orgId` undefined/null edits the system default. */
  async update(
    orgId: string | null | undefined,
    patch: Partial<EffectiveSearchConfig>,
  ): Promise<SearchConfig> {
    const row = await this.getRow(orgId);
    return this.db.searchConfig.update({ where: { id: row.id }, data: patch });
  }
}
