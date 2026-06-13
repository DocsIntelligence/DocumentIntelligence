import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  SETTINGS,
  type SettingDef,
  type SettingScope,
} from './settings.keys';

interface ResolveCtx {
  userId?: string | null;
  orgId?: string | null;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;

/**
 * Generic scoped configuration store. `get<T>(def, ctx)` walks
 *   user → org → system → built-in default in code
 * and returns the first match. Writes are scoped (`set(def, value, { scope,
 * scopeId })`); narrower writes never silently overwrite a broader scope.
 *
 * In-memory micro-cache (~30 s) so hot paths (every AI call) don't slam the
 * DB. Cache is keyed by `(scope, scopeId, key)` and invalidated on write
 * (mutation methods clear the relevant keys).
 */
@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly db: DatabaseService) {}

  /** Resolve a setting for an actor. Returns the registered default if no row.
   *
   *  Lookup order (narrowest wins):
   *    1. user override (only when `def.scope === 'user'` and ctx.userId set)
   *    2. org override (when `def.scope` in {'user','org'} and ctx.orgId set)
   *    3. system override
   *    4. `def.default` (the in-code fallback).
   */
  async get<T>(def: SettingDef<T>, ctx: ResolveCtx = {}): Promise<T> {
    const lookups = this.buildLookupChain(def.scope, ctx);
    for (const [scope, scopeId] of lookups) {
      const v = await this.readScoped(def.key, scope, scopeId);
      if (v !== undefined) return v as T;
    }
    return def.default;
  }

  /** Synchronously known default — never hits the DB. Use when you only need
   *  the fallback (e.g. seeding UI state). */
  defaultOf<T>(def: SettingDef<T>): T {
    return def.default;
  }

  /** Set an override at the given scope. */
  async set<T>(
    def: SettingDef<T>,
    value: T,
    target: { scope: SettingScope; scopeId?: string | null; notes?: string },
  ): Promise<void> {
    this.assertScopeAllowed(def, target.scope);
    if (target.scope !== 'system' && !target.scopeId) {
      throw new Error(`scope=${target.scope} requires a scopeId`);
    }
    const scopeId = target.scope === 'system' ? '' : target.scopeId ?? '';
    await this.db.setting.upsert({
      where: {
        scope_scopeId_key: {
          scope: target.scope,
          scopeId,
          key: def.key,
        },
      },
      create: {
        key: def.key,
        scope: target.scope,
        scopeId,
        value: value as never,
        notes: target.notes ?? null,
      },
      update: {
        value: value as never,
        notes: target.notes ?? null,
      },
    });
    this.invalidate(def.key);
  }

  /** Remove an override. */
  async clear(
    def: SettingDef<unknown>,
    target: { scope: SettingScope; scopeId?: string | null },
  ): Promise<void> {
    const scopeId = target.scope === 'system' ? '' : target.scopeId ?? '';
    await this.db.setting.deleteMany({
      where: { key: def.key, scope: target.scope, scopeId },
    });
    this.invalidate(def.key);
  }

  /** List every registered setting + its current effective values for a scope.
   *  Used by the admin UI. */
  async listForScope(target: {
    scope: SettingScope;
    scopeId?: string | null;
  }): Promise<
    {
      def: SettingDef<unknown>;
      override?: { value: unknown; notes?: string | null };
      effective: unknown;
    }[]
  > {
    const all = Object.values(SETTINGS) as SettingDef<unknown>[];
    const scopeId = target.scope === 'system' ? '' : target.scopeId ?? '';
    const rows = await this.db.setting.findMany({
      where: {
        scope: target.scope,
        scopeId,
        key: { in: all.map((d) => d.key) },
      },
    });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const out: Awaited<ReturnType<typeof this.listForScope>> = [];
    for (const def of all) {
      const row = byKey.get(def.key);
      const effective = await this.get(def, {
        userId: target.scope === 'user' ? scopeId : null,
        orgId: target.scope === 'org' ? scopeId : null,
      });
      out.push({
        def,
        override: row ? { value: row.value, notes: row.notes } : undefined,
        effective,
      });
    }
    return out;
  }

  // ── internals ──────────────────────────────────────────────────────────
  private buildLookupChain(
    scope: SettingScope,
    ctx: ResolveCtx,
  ): Array<[SettingScope, string]> {
    const chain: Array<[SettingScope, string]> = [];
    if (scope === 'user' && ctx.userId) chain.push(['user', ctx.userId]);
    if ((scope === 'user' || scope === 'org') && ctx.orgId)
      chain.push(['org', ctx.orgId]);
    chain.push(['system', '']);
    return chain;
  }

  private async readScoped(
    key: string,
    scope: SettingScope,
    scopeId: string,
  ): Promise<unknown | undefined> {
    const cacheKey = `${scope}|${scopeId}|${key}`;
    const hit = this.cache.get(cacheKey);
    const now = Date.now();
    if (hit && hit.expiresAt > now) return hit.value;
    const row = await this.db.setting.findFirst({
      where: { key, scope, scopeId },
      select: { value: true },
    });
    const value = row?.value;
    this.cache.set(cacheKey, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  }

  private assertScopeAllowed(def: SettingDef<unknown>, scope: SettingScope) {
    if (def.scope === 'system' && scope !== 'system') {
      throw new Error(
        `Setting "${def.key}" is system-only; can't override per ${scope}.`,
      );
    }
    if (def.scope === 'org' && scope === 'user') {
      throw new Error(
        `Setting "${def.key}" is org-scoped; per-user override not allowed.`,
      );
    }
  }

  private invalidate(key: string) {
    for (const k of this.cache.keys()) if (k.endsWith(`|${key}`)) this.cache.delete(k);
  }
}

export { findSetting, SETTINGS, type SettingDef, type SettingScope } from './settings.keys';
