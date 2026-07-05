/**
 * Vite-only env config for the React dashboard (apps/app).
 * Read from import.meta.env — VITE_* vars are inlined at build time.
 */

export const APP_ENV = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:5230/api',
  appUrl: import.meta.env.VITE_APP_URL ?? 'http://localhost:5200',
  /** Public marketing host where `/law/*` pages live (SSR'd by apps/web). */
  webUrl: import.meta.env.VITE_WEB_URL ?? 'http://localhost:5220',
  razorpayKeyId: import.meta.env.VITE_RAZORPAY_KEY_ID ?? '',
  appName: import.meta.env.VITE_APP_NAME ?? 'Document Builder - React',
} as const;

/** Absolute URL to a public citation page. The catalog lives on the
 *  marketing site (apps/web) for SEO + SSR, so any in-app link to a citation
 *  must use the marketing host, not a SPA-relative `/law/...`. */
export function lawUrl(citationId: string): string {
  const slug = citationId.replace(/\./g, '-');
  return `${APP_ENV.webUrl.replace(/\/$/, '')}/law/${slug}`;
}
