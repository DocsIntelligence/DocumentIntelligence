import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Feature } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  requireBundle,
  getBundle,
  type PromptDefinition,
} from '@org/document-schema';
import { CRIMINAL_CODE_REFORM_NOTE } from '@org/legal-reference';
import { scaffoldForPreset } from './court-scaffolds';
import { AiService } from '../ai/ai.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import type {
  ClauseRewriteDto,
  RuleSuggestDto,
  GenerateDocumentDto,
  ReviseDocumentDto,
} from './legal-ai.dto';

const DISCLAIMER =
  '\n\n— AI-suggested. Review with a qualified advocate before binding use.';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Cross-document drafting guardrails. The model NEVER authors statute section
// numbers — a curated citation library fills those later (see docs). It also
// must not impersonate a court. Output is editor-ready HTML with {{placeholders}}.
const GENERATE_SYSTEM = `You are an expert Indian legal document drafter. Produce a clean, professional, ready-to-edit document as semantic HTML.

Rules:
- Output ONLY the document body as HTML (use h1, h2, h3, p, ol, ul, li, strong, em). No markdown, no <html>/<head>/<body> wrappers, and no code fences.
- For any party-specific or fill-in value you do not know (names, addresses, dates, amounts, etc.), insert a placeholder token of the form {{snake_case_key}} — e.g. {{landlord_name}}, {{monthly_rent}}, {{agreement_date}}. Reuse the same key whenever the same value recurs.
- Only insert <div data-page-break></div> when the document is long enough to genuinely span multiple printed pages (roughly 500+ words per page). Do NOT add page breaks to short documents or between every section — only before a major section that should clearly start on a fresh page in a lengthy document.
- Do NOT cite specific statute section numbers or case law. Where a legal reference is needed, write the neutral placeholder {{applicable_law}} — a qualified human inserts the correct citation.
- Never impersonate a court or issue a judicial order.
- Indian context: use ₹ for currency, Indian date conventions, and Indian legal drafting style.`;

const REVISE_SYSTEM = `You are editing an existing Indian legal document supplied as HTML. Apply the user's instruction and return the COMPLETE updated document as HTML, preserving everything the instruction does not change.

Rules:
- Keep existing {{placeholder}} tokens intact unless the instruction is specifically to fill or change them.
- Output ONLY the HTML document body — no code fences, no commentary, no explanation.
- Same drafting rules as generation: no statute section numbers (use {{applicable_law}}), Indian context. Only add page breaks (<div data-page-break></div>) if the document is long enough to span multiple printed pages — do not add them to short documents.`;

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

  // ─── Whole-document drafting (feeds the freeform editor) ─────────────────

  /** Draft a complete document as editor-ready HTML from a natural-language brief. */
  async generateDocument(
    userId: string,
    dto: GenerateDocumentDto,
  ): Promise<{
    html: string;
    model: string;
    cached: boolean;
    placeholders: string[];
    disclaimer: string;
  }> {
    const bundle = dto.documentTypeKey
      ? getBundle(dto.documentTypeKey)
      : undefined;
    let system = GENERATE_SYSTEM;
    if (bundle) {
      system += `\n\nThis document is a "${bundle.key}". Typical sections (guidance — adapt to the brief): ${bundle.sectionOrder.join(', ')}.`;
    }
    system += `\n\nLanguage: write the ENTIRE document — every heading, clause, label, and sentence — in ${dto.language}. The ONLY exception: keep {{placeholder}} tokens exactly as given (Latin snake_case keys, e.g. {{landlord_name}}); never translate the keys themselves. If ${dto.language} is not English, still keep ₹ and Indian legal conventions.`;
    system += `\n\n${CRIMINAL_CODE_REFORM_NOTE}`;
    const scaffold = scaffoldForPreset(dto.presetKey);
    if (scaffold) system += `\n\n${scaffold}`;
    const userMessage =
      (dto.title ? `Title: ${dto.title}\n` : '') + `Brief:\n${dto.brief}`;

    const { html, model, cached } = await this.generateHtml(
      userId,
      system,
      userMessage,
      `gen:${dto.documentTypeKey ?? 'freeform'}`,
    );
    return {
      html,
      model,
      cached,
      placeholders: extractPlaceholders(html),
      disclaimer: DISCLAIMER.trim(),
    };
  }

  /** Apply a natural-language instruction to an existing document's HTML. */
  async reviseDocument(
    userId: string,
    dto: ReviseDocumentDto,
  ): Promise<{
    html: string;
    model: string;
    cached: boolean;
    placeholders: string[];
  }> {
    const bundle = dto.documentTypeKey
      ? getBundle(dto.documentTypeKey)
      : undefined;
    let system = REVISE_SYSTEM;
    if (bundle) system += `\n\nDocument type: "${bundle.key}".`;
    if (dto.language) {
      system += `\n\nLanguage: rewrite/translate the ENTIRE document into ${dto.language}, preserving meaning, structure, and all {{placeholder}} keys (keep keys in Latin snake_case).`;
    }
    system += `\n\n${CRIMINAL_CODE_REFORM_NOTE}`;
    const userMessage = `Instruction:\n${dto.instruction}\n\nCurrent document HTML:\n${dto.html}`;

    const { html, model, cached } = await this.generateHtml(
      userId,
      system,
      userMessage,
      `rev:${dto.documentTypeKey ?? 'freeform'}`,
    );
    return { html, model, cached, placeholders: extractPlaceholders(html) };
  }

  /** Shared HTML-generation path: quota → cache → AI → strip fences → meter. */
  private async generateHtml(
    userId: string,
    system: string,
    userMessage: string,
    seed: string,
  ): Promise<{ html: string; model: string; cached: boolean }> {
    const ok = await this.walletUsage.checkQuota(userId, Feature.ai_attempts);
    if (!ok) {
      throw new ForbiddenException(
        'AI quota exhausted. Upgrade your plan for more AI attempts.',
      );
    }

    const cacheKey = hashKey(seed, 'v1', `${system}\n${userMessage}`);
    const cachedHtml = this.readCache(cacheKey);
    if (cachedHtml) return { html: cachedHtml, model: 'cached', cached: true };

    const res = await this.ai.generate(userMessage, {
      systemPrompt: system,
      maxTokens: 16000,
    });
    const html = stripCodeFences(res.text).trim();

    this.writeCache(cacheKey, html);
    await this.walletUsage.trackUsage(userId, Feature.ai_attempts, 1);
    return { html, model: res.model, cached: false };
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

/** Strip a leading ```lang fence and trailing ``` that some models wrap output in. */
function stripCodeFences(s: string): string {
  return s
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '');
}

/** Pull every {{key}} from an HTML string. Order preserved, duplicates removed. */
function extractPlaceholders(html: string): string[] {
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}
