/**
 * Shared brand & product config — static values only.
 * No environment-variable reads here. Each app owns its own env config:
 *   - apps/app/src/config.ts (Vite, import.meta.env)
 *   - apps/web/src/config.ts (Next.js, process.env.NEXT_PUBLIC_*)
 *   - apps/api uses its own ConfigModule (apps/api/src/app/config)
 */

export const APP_CONFIG = {
  name: 'Vidhi',
  tagline: 'Legal documents, drafted right.',
  description:
    'India-first legal-document drafting platform: guided forms, an AI copilot, and statute-accurate citations — with a live, stamp-paper-aware preview and PDF/DOCX export.',
  logo: '/logo.svg',
  favicon: '/favicon.ico',

  support: {
    email: 'support@vidhi.app',
    docs: '/docs',
  },

  auth: {
    cookieDomain: 'localhost',
    providers: ['email', 'google', 'github', 'linkedin'] as const,
    adminEmail: 'admin@example.com',
  },

  payment: {
    gateway: 'razorpay' as 'razorpay' | 'stripe' | 'both',
    currency: 'INR' as string,
    currencySymbol: '₹' as string,
  },

  features: [
    'documents',
    'ai_tokens',
    'ai_attempts',
    'storage_mb',
    'api_calls',
  ] as const,
} as const;

export type AppConfig = typeof APP_CONFIG;
export type FeatureName = (typeof APP_CONFIG.features)[number];
