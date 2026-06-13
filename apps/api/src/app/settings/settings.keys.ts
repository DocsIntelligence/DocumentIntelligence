/**
 * Registry of every known setting key + its built-in default + value shape.
 *
 * Adding a new toggle / threshold:
 *  1. Add an entry below — pick a dotted key (`module.subsystem.thing`).
 *  2. Pick `scope` = the LOOSEST scope this key supports. A `'system'`-only key
 *     can never be overridden per-org/user; a `'user'` key can be overridden at
 *     any of system → org → user (narrower wins).
 *  3. Default is the value used when no DB override is set.
 *  4. The shape is plain JSON — booleans, numbers, strings, arrays, objects all
 *     serialise fine. Keep it small; this is config, not data.
 *
 * The storage row never changes — future modules can add keys here without a
 * migration.
 */

export type SettingScope = 'system' | 'org' | 'user';

export interface SettingDef<T> {
  /** Dotted key, unique. */
  key: string;
  /** Loosest scope at which this can be overridden. */
  scope: SettingScope;
  /** Built-in default — used when no DB row exists. */
  default: T;
  /** Human label (admin UI). */
  label: string;
  /** Description (admin UI). */
  description: string;
  /** UI input shape; auto-inferred from default's type when omitted. */
  type?: 'boolean' | 'number' | 'string' | 'json';
}

const def = <T>(d: SettingDef<T>): SettingDef<T> => d;

/** Master registry. Reads as a flat object so callers can do
 *  `settings.get(SETTINGS.AI_USAGE_TRACKING_ENABLED, { userId, orgId })`. */
export const SETTINGS = {
  AI_USAGE_TRACKING_ENABLED: def({
    key: 'ai.usage.tracking.enabled',
    scope: 'user',
    default: true,
    label: 'Track AI usage',
    description:
      'Master switch — record every AI call to the usage ledger. Disable to opt out entirely; dashboards stop showing new rows. Per-scope and per-operation toggles below give finer control without flipping this off.',
  }),
  // ── Per-scope toggles (default ON; flip OFF to mute the noisy lane) ─────
  AI_USAGE_TRACKING_DOCUMENT: def({
    key: 'ai.usage.tracking.scope.document',
    scope: 'user',
    default: true,
    label: 'Record drafting-document calls',
    description:
      'Log AI calls attributed to a drafting Document (Documents → builder/draft-with-AI). Turn off if you only care about Intelligence-pipeline costs.',
  }),
  AI_USAGE_TRACKING_SOURCE: def({
    key: 'ai.usage.tracking.scope.source',
    scope: 'user',
    default: true,
    label: 'Record source-document calls',
    description:
      'Log AI calls attributed to an uploaded SourceDocument (analyze / ask / classify / extract on an upload).',
  }),
  AI_USAGE_TRACKING_PIPELINE_RUN: def({
    key: 'ai.usage.tracking.scope.pipelineRun',
    scope: 'user',
    default: true,
    label: 'Record pipeline-run calls',
    description:
      'Log AI calls attributed to a PipelineRun (classify → extract → critique stages inside a pipeline).',
  }),
  AI_USAGE_TRACKING_BATCH: def({
    key: 'ai.usage.tracking.scope.batch',
    scope: 'user',
    default: true,
    label: 'Record batch-level calls',
    description:
      'Log AI calls attributed to a Batch (multi-file upload). Disabling this also disables per-pipeline-run logging that rolls up into the batch.',
  }),
  AI_USAGE_TRACKING_UNSCOPED: def({
    key: 'ai.usage.tracking.scope.unscoped',
    scope: 'user',
    default: true,
    label: 'Record un-attributed calls',
    description:
      'Log AI calls with NO subject attached (admin / cron / orphaned). Turn off to keep the ledger focused on production traffic only.',
  }),
  // ── Per-operation skip list ─────────────────────────────────────────────
  AI_USAGE_TRACKING_SKIP_OPS: def({
    key: 'ai.usage.tracking.skipOperations',
    scope: 'user',
    default: [] as string[],
    label: 'Skip these operations',
    description:
      "List of `operation` names to drop from the ledger. Typical noisy ones: ['embed'] (high call volume, low cost), ['classify'] (cheap + frequent). Empty array = record everything.",
    type: 'json',
  }),
  AI_USAGE_BUDGET_ENFORCED: def({
    key: 'ai.usage.budget.enforced',
    scope: 'org',
    default: true,
    label: 'Enforce AI budgets',
    description:
      'When a hard budget is exceeded, block further AI calls with 402 Payment Required. Soft budgets still warn either way.',
  }),
  AI_USAGE_RETENTION_DAYS: def({
    key: 'ai.usage.retention.days',
    scope: 'org',
    default: 365,
    label: 'Usage record retention (days)',
    description:
      'A nightly job purges AiUsage rows older than this. Increase for compliance, reduce to save storage.',
  }),
  AI_USAGE_REDACT_PROMPTS: def({
    key: 'ai.usage.redact.prompts',
    scope: 'org',
    default: true,
    label: 'Redact prompt content',
    description:
      'When on, the usage ledger stores token counts + metadata but not the prompt or completion text.',
  }),
} as const;

export type SettingKey = (typeof SETTINGS)[keyof typeof SETTINGS]['key'];

/** Find a registered setting by its dotted key (used by the admin API). */
export const findSetting = (
  key: string,
): SettingDef<unknown> | undefined =>
  Object.values(SETTINGS).find((s) => s.key === key) as
    | SettingDef<unknown>
    | undefined;
