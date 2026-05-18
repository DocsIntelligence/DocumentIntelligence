import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Feature } from '@prisma/client';
import { createHash } from 'node:crypto';
import { requireBundle, type PromptDefinition } from '@org/document-schema';
import { AiService } from '../ai/ai.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import type { ClauseRewriteDto, RuleSuggestDto } from './legal-ai.dto';

const DISCLAIMER =
  '\n\n— AI-suggested. Review with a qualified advocate before binding use.';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  text: string;
  insertedAt: number;
}

/**
 * Legal-AI service. Wraps the generic AiService with:
 *   - prompt lookup from the document-schema registry
 *   - {{handlebars}} placeholder substitution
 *   - per-user WalletUsage decrement (`ai_attempts`)
 *   - in-memory 24h cache keyed by (prompt id, input hash)
 *   - disclaimer append
 *
 * The in-memory cache is sufficient for a single API instance; swap to
 * Redis (via ioredis already in deps) when scaling horizontally.
 */
@Injectable()
export class LegalAiService {
  private readonly logger = new Logger(LegalAiService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly ai: AiService,
    private readonly walletUsage: WalletUsageService,
  ) {}

  async clauseRewrite(userId: string, dto: ClauseRewriteDto) {
    return this.runPrompt(userId, dto.documentTypeKey, dto.promptKey, {
      clause: dto.clause,
      tone: dto.tone,
      audience: dto.audience,
      jurisdiction: dto.jurisdiction,
    });
  }

  async ruleSuggest(userId: string, dto: RuleSuggestDto) {
    return this.runPrompt(userId, dto.documentTypeKey, 'rules.suggest', {
      propertyType: dto.propertyType,
      furnished: dto.furnished,
      city: dto.city,
      existingRules: dto.existingRules.join('; ') || 'none',
    });
  }

  // ─── Core ──────────────────────────────────────────────────────────────

  private async runPrompt(
    userId: string,
    documentTypeKey: string,
    promptKey: string,
    vars: Record<string, string>,
  ): Promise<{ text: string; cached: boolean; model: string }> {
    const ok = await this.walletUsage.checkQuota(userId, Feature.ai_attempts);
    if (!ok) {
      throw new ForbiddenException(
        'AI quota exhausted. Upgrade your plan for more AI attempts.',
      );
    }

    const bundle = requireBundle(documentTypeKey);
    const prompt: PromptDefinition | undefined = bundle.prompts[promptKey];
    if (!prompt) {
      throw new BadRequestException(
        `Unknown prompt "${promptKey}" for type "${documentTypeKey}"`,
      );
    }

    const userMessage = fillPlaceholders(prompt.user, vars);
    const cacheKey = hashKey(prompt.id, prompt.version, userMessage);
    const cached = this.readCache(cacheKey);
    if (cached) {
      return { text: cached + DISCLAIMER, cached: true, model: prompt.model };
    }

    const res = await this.ai.generate(userMessage, {
      systemPrompt: prompt.system,
      temperature: prompt.temperature,
    });

    this.writeCache(cacheKey, res.text);
    await this.walletUsage.trackUsage(userId, Feature.ai_attempts, 1);

    return {
      text: res.text + DISCLAIMER,
      cached: false,
      model: res.model || prompt.model,
    };
  }

  // ─── Cache ─────────────────────────────────────────────────────────────

  private readCache(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.insertedAt > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }
    return entry.text;
  }

  private writeCache(key: string, text: string): void {
    this.cache.set(key, { text, insertedAt: Date.now() });
    if (this.cache.size > 1000) {
      // crude LRU: drop the oldest 200 entries when we exceed cap
      const entries = [...this.cache.entries()].sort(
        (a, b) => a[1].insertedAt - b[1].insertedAt,
      );
      for (let i = 0; i < 200 && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function fillPlaceholders(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? `[${key}]`;
  });
}

function hashKey(id: string, version: string, input: string): string {
  return createHash('sha256').update(`${id}|${version}|${input}`).digest('hex');
}
