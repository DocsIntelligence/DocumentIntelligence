/**
 * Next-only env config for the marketing/landing site (apps/web).
 * NEXT_PUBLIC_* vars are inlined into the client bundle by Next at build time;
 * non-prefixed vars are only available on the server.
 */

export const WEB_ENV = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api',
  webUrl: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:5220',
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
} as const;
