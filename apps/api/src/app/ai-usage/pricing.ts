/**
 * Built-in rate cards used as a seed + fallback when no DB row matches.
 * Prices are in USD per 1,000,000 units (tokens unless `unitType` says
 * otherwise). Numbers are best-effort public-list prices at the time the
 * model shipped; admins edit per-row in `AiModelPricing` to override.
 *
 * Sources for the seeds (admin should re-verify before going live):
 *  • OpenAI:    https://openai.com/api/pricing/
 *  • Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/pricing
 *  • Google:    https://ai.google.dev/gemini-api/docs/pricing
 *  • LlamaParse / Reducto: per-page pricing; see vendor docs.
 *
 * Look-up policy (`findBuiltInPricing`): exact (provider+model) hit first,
 * then provider prefix (e.g. 'gpt-5o' under 'gpt-5o-*'), then null. The
 * recorder then falls back to a zero-cost row so a missing rate-card never
 * blocks the call; the row is flagged with `pricingId=null` so finance can
 * audit which calls were uncosted.
 */

export interface BuiltInRate {
  provider: string;
  model: string;
  unitType?: 'tokens' | 'pages' | 'characters' | 'requests' | 'seconds' | 'images';
  inputPer1M?: number;
  outputPer1M?: number;
  cachedInputPer1M?: number;
  cacheWritePer1M?: number;
  reasoningPer1M?: number;
  perCallUsd?: number;
}

/** Conservative seed prices. Update through the admin UI for production. */
export const BUILT_IN_PRICING: BuiltInRate[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────
  // Claude Opus tier
  {
    provider: 'anthropic',
    model: 'claude-opus-4-7',
    inputPer1M: 15,
    outputPer1M: 75,
    cachedInputPer1M: 1.5,
    cacheWritePer1M: 18.75,
  },
  {
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    inputPer1M: 15,
    outputPer1M: 75,
    cachedInputPer1M: 1.5,
    cacheWritePer1M: 18.75,
  },
  // Claude Sonnet tier
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    inputPer1M: 3,
    outputPer1M: 15,
    cachedInputPer1M: 0.3,
    cacheWritePer1M: 3.75,
  },
  // Claude Haiku tier
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    inputPer1M: 1,
    outputPer1M: 5,
    cachedInputPer1M: 0.1,
    cacheWritePer1M: 1.25,
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    inputPer1M: 1,
    outputPer1M: 5,
    cachedInputPer1M: 0.1,
    cacheWritePer1M: 1.25,
  },

  // ── OpenAI ─────────────────────────────────────────────────────────────
  // GPT-5 tier (placeholder seeds — replace with real prices)
  { provider: 'openai', model: 'gpt-5', inputPer1M: 10, outputPer1M: 40 },
  { provider: 'openai', model: 'gpt-5o', inputPer1M: 2.5, outputPer1M: 10 },
  { provider: 'openai', model: 'gpt-5o-mini', inputPer1M: 0.15, outputPer1M: 0.6 },
  // GPT-4.1 tier (April-2025 family — prefix-matched so dated aliases like
  // 'gpt-4.1-mini-2025-04-14' resolve to the base price)
  { provider: 'openai', model: 'gpt-4.1', inputPer1M: 2, outputPer1M: 8, cachedInputPer1M: 0.5 },
  { provider: 'openai', model: 'gpt-4.1-mini', inputPer1M: 0.4, outputPer1M: 1.6, cachedInputPer1M: 0.1 },
  { provider: 'openai', model: 'gpt-4.1-nano', inputPer1M: 0.1, outputPer1M: 0.4, cachedInputPer1M: 0.025 },
  // GPT-4o tier
  { provider: 'openai', model: 'gpt-4o', inputPer1M: 2.5, outputPer1M: 10, cachedInputPer1M: 1.25 },
  { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6, cachedInputPer1M: 0.075 },
  // o-series (reasoning models — separate reasoning-token lane)
  { provider: 'openai', model: 'o3', inputPer1M: 2, outputPer1M: 8, cachedInputPer1M: 0.5, reasoningPer1M: 8 },
  { provider: 'openai', model: 'o3-mini', inputPer1M: 1.1, outputPer1M: 4.4, cachedInputPer1M: 0.55, reasoningPer1M: 4.4 },
  { provider: 'openai', model: 'o4-mini', inputPer1M: 1.1, outputPer1M: 4.4, cachedInputPer1M: 0.275, reasoningPer1M: 4.4 },

  // Embeddings
  {
    provider: 'openai',
    model: 'text-embedding-3-small',
    inputPer1M: 0.02,
    outputPer1M: 0,
  },
  {
    provider: 'openai',
    model: 'text-embedding-3-large',
    inputPer1M: 0.13,
    outputPer1M: 0,
  },

  // ── Google ─────────────────────────────────────────────────────────────
  {
    provider: 'google',
    model: 'gemini-2.0-flash',
    inputPer1M: 0.1,
    outputPer1M: 0.4,
  },
  {
    provider: 'google',
    model: 'gemini-2.5-pro',
    inputPer1M: 1.25,
    outputPer1M: 5,
  },

  // ── LlamaParse / Reducto (per-page, not per-token) ────────────────────
  {
    provider: 'llamaparse',
    model: 'default',
    unitType: 'pages',
    perCallUsd: 0,
    // 1.0 USD / 1000 pages = 1000 USD / 1M pages
    inputPer1M: 1000,
  },
];

/** Look up the in-code rate card by provider + model. Used as fallback when
 *  the admin hasn't loaded a DB price row yet. */
export function findBuiltInPricing(
  provider: string,
  model: string,
): BuiltInRate | null {
  const p = provider.toLowerCase();
  const m = model.toLowerCase();
  const exact = BUILT_IN_PRICING.find(
    (r) => r.provider.toLowerCase() === p && r.model.toLowerCase() === m,
  );
  if (exact) return exact;
  // Fall back to a model-prefix match (e.g. dated alias claude-haiku-4-5-20251001
  // or gpt-4.1-mini-2025-04-14). Pick the LONGEST matching base name so the
  // 'gpt-4.1-mini' variant doesn't get mis-priced as the 'gpt-4.1' base.
  let best: BuiltInRate | null = null;
  for (const r of BUILT_IN_PRICING) {
    const base = r.model.toLowerCase();
    if (r.provider.toLowerCase() !== p || !m.startsWith(base)) continue;
    if (!best || base.length > best.model.length) best = r;
  }
  return best;
}

/** USD cost for a given token / unit breakdown against a rate card. */
export function computeCost(
  rate: BuiltInRate,
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
    unitsUsed?: number;
  },
): number {
  const million = 1_000_000;
  let cost = rate.perCallUsd ?? 0;
  const input = usage.inputTokens ?? usage.unitsUsed ?? 0;
  if (rate.inputPer1M) cost += (input / million) * rate.inputPer1M;
  if (rate.outputPer1M && usage.outputTokens)
    cost += (usage.outputTokens / million) * rate.outputPer1M;
  if (rate.cachedInputPer1M && usage.cachedInputTokens)
    cost += (usage.cachedInputTokens / million) * rate.cachedInputPer1M;
  if (rate.cacheWritePer1M && usage.cacheWriteTokens)
    cost += (usage.cacheWriteTokens / million) * rate.cacheWritePer1M;
  if (rate.reasoningPer1M && usage.reasoningTokens)
    cost += (usage.reasoningTokens / million) * rate.reasoningPer1M;
  return Number(cost.toFixed(6));
}
