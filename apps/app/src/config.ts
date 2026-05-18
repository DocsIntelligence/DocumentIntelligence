/**
 * Vite-only env config for the React dashboard (apps/app).
 * Read from import.meta.env — VITE_* vars are inlined at build time.
 */

export const APP_ENV = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  appUrl: import.meta.env.VITE_APP_URL ?? 'http://localhost:4200',
  razorpayKeyId: import.meta.env.VITE_RAZORPAY_KEY_ID ?? '',
  appName: import.meta.env.VITE_APP_NAME ?? 'Document Builder - React',
} as const;
