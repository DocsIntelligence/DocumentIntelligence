import { APP_CONFIG } from '@org/utils';

/**
 * Public-facing brand name. Set via NEXT_PUBLIC_SITE_NAME so it can be
 * changed without code edits. Falls back to the shared `APP_CONFIG.name`
 * so the dev environment matches the rest of the product.
 *
 * NEXT_PUBLIC_* vars are inlined at build time, so this works in both
 * server and client components.
 */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? APP_CONFIG.name;
