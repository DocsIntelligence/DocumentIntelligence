import { z } from 'zod';

// ─── Custom validators ──────────────────────────────────────────────────────

const ttlString = z
  .string()
  .regex(/^\d+(s|m|h|d)$/, 'Must be a duration like "15m", "1h", "7d"');

// ─── Schema ─────────────────────────────────────────────────────────────────

export const envSchema = z.object({
  // ── App (required) ────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  GLOBAL_PREFIX: z.string().min(1),
  PUBLIC_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1),

  // ── Cookies (required) ────────────────────────────────────────────────
  COOKIE_DOMAIN: z.string().min(1),
  COOKIE_SECURE: z.enum(['true', 'false']).transform((v) => v === 'true'),

  // ── Auth / JWT (required) ─────────────────────────────────────────────
  ACCESS_TOKEN_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: ttlString,
  REFRESH_TOKEN_SECRET: z.string().min(16),
  REFRESH_TOKEN_TTL: ttlString,

  // ── Database (required) ───────────────────────────────────────────────
  DATABASE_URL: z.string().min(1),

  // ── Logging (required) ────────────────────────────────────────────────
  LOG_LEVEL: z.enum([
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ]),

  // ── OAuth: Google (optional — warn if missing) ────────────────────────
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  // ── OAuth: GitHub (optional — warn if missing) ────────────────────────
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),

  // ── OAuth: LinkedIn (optional — warn if missing) ──────────────────────
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
  LINKEDIN_CALLBACK_URL: z.string().url().optional(),

  // ── Mail / SMTP (optional — warn if missing) ──────────────────────────
  MAIL_HOST: z.string().min(1).optional(),
  MAIL_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  MAIL_USER: z.string().min(1).optional(),
  MAIL_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM: z.string().email().optional(),

  // ── Payment: Razorpay (optional — warn if missing) ────────────────────
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── Payment: Stripe (optional — warn if missing) ──────────────────────
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),

  // ── Redis (optional — for queue, falls back to in-memory)
  REDIS_URL: z.string().min(1).optional(),

  // ── Document Vault: AES-256-GCM key for encrypting entity field data at rest.
  // base64-encoded 32 bytes (`openssl rand -base64 32`). REQUIRED in production;
  // in dev a deterministic key is derived with a loud warning if unset.
  VAULT_ENCRYPTION_KEY: z.string().min(1).optional(),

  // ── AI Providers (optional — warn if missing)
  // Default provider for AiService priority/fallback (Document Intelligence
  // extraction + legal-ai). Default: openai.
  AI_DEFAULT_PROVIDER: z.enum(['openai', 'claude', 'gemini']).optional(),
  // Optional allow-list of `provider:model` combos (comma-separated). Empty = all.
  AI_MODEL_WHITELIST: z.string().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  OPENAI_VISION_MODEL: z.string().min(1).optional(), // default: OPENAI_MODEL
  OPENAI_EMBED_MODEL: z.string().min(1).optional(), // default: text-embedding-3-small
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).optional(), // default: claude-opus-4-8
  ANTHROPIC_VISION_MODEL: z.string().min(1).optional(), // default: ANTHROPIC_MODEL

  // ── Document Intelligence: premium agentic extraction (optional)
  // Vendor-agnostic hosted agentic parser (LlamaParse / Reducto / self-hosted).
  // When BASE_URL + API_KEY are set, the premium extraction tier is available.
  EXTRACTION_AGENTIC_BASE_URL: z.string().url().optional(),
  EXTRACTION_AGENTIC_API_KEY: z.string().min(1).optional(),
  EXTRACTION_AGENTIC_MODEL: z.string().min(1).optional(),
  EXTRACTION_AGENTIC_RESPONSE_PATH: z.string().min(1).optional(),
  EXTRACTION_AGENTIC_PROVIDER: z.string().min(1).optional(),
  // Agentic critic re-verification pass (docs/05 §3). Default on; 'false' to disable.
  EXTRACTION_CRITIC_ENABLED: z.enum(['true', 'false']).optional(),

  // ── Storage: S3-compatible (optional — warn if missing)
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_SECRET_KEY: z.string().min(1).optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_PUBLIC_URL: z.string().url().optional(), // Public URL prefix for files
  STORAGE_LOCAL_ROOT: z.string().min(1).optional(), // Dev-only: dir for local-fs fallback

  // ── Billing / quota (optional) ────────────────────────────────────────
  // Master switch for WalletUsage quota enforcement (AI attempts, document
  // creation, premium extraction). Defaults to enforced; set 'false' to let
  // every request through regardless of wallet/usage state.
  BILLING_ENFORCED: z.enum(['true', 'false']).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

// ─── Validation with warnings ───────────────────────────────────────────────

const OPTIONAL_GROUPS = [
  {
    name: 'Google OAuth',
    fields: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'],
  },
  {
    name: 'GitHub OAuth',
    fields: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL'],
  },
  {
    name: 'LinkedIn OAuth',
    fields: [
      'LINKEDIN_CLIENT_ID',
      'LINKEDIN_CLIENT_SECRET',
      'LINKEDIN_CALLBACK_URL',
    ],
  },
  { name: 'Mail/SMTP', fields: ['MAIL_HOST', 'MAIL_PORT', 'MAIL_FROM'] },
  {
    name: 'Razorpay',
    fields: [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
    ],
  },
  {
    name: 'Stripe',
    fields: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PUBLISHABLE_KEY',
    ],
  },
  { name: 'Redis (Queue)', fields: ['REDIS_URL'] },
  { name: 'OpenAI', fields: ['OPENAI_API_KEY'] },
  { name: 'Gemini', fields: ['GEMINI_API_KEY'] },
  { name: 'Anthropic (Claude)', fields: ['ANTHROPIC_API_KEY'] },
  {
    name: 'Agentic Extraction (premium)',
    fields: ['EXTRACTION_AGENTIC_BASE_URL', 'EXTRACTION_AGENTIC_API_KEY'],
  },
  {
    name: 'Storage (S3)',
    fields: [
      'STORAGE_ENDPOINT',
      'STORAGE_ACCESS_KEY',
      'STORAGE_SECRET_KEY',
      'STORAGE_BUCKET',
    ],
  },
] as const;

export const validateEnv = (env: Record<string, unknown>): AppConfig => {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `\n❌ Missing required environment variables:\n${errors}\n\nCopy .env.example to .env and fill in all required values.\n`,
    );
  }

  // Warn about optional groups that are partially configured
  const warnings: string[] = [];
  const data = parsed.data as Record<string, unknown>;

  for (const group of OPTIONAL_GROUPS) {
    const set = group.fields.filter((f) => Boolean(data[f]));
    if (set.length === 0) {
      warnings.push(`  ⚠ ${group.name}: not configured (feature disabled)`);
    } else if (set.length < group.fields.length) {
      const missing = group.fields.filter((f) => !data[f]);
      warnings.push(
        `  ⚠ ${group.name}: partially configured — missing: ${missing.join(', ')}`,
      );
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `\n⚠️  Optional configuration warnings:\n${warnings.join('\n')}\n`,
    );
  }

  return parsed.data;
};
