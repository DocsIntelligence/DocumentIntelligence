/**
 * Public-facing brand name. Set via NEXT_PUBLIC_SITE_NAME so it can be
 * changed without code edits. Falls back to "Document Portal" so the
 * dev environment isn't blank.
 *
 * NEXT_PUBLIC_* vars are inlined at build time, so this works in both
 * server and client components.
 */
export const SITE_NAME =
  process.env.NEXT_PUBLIC_SITE_NAME ?? 'Document Portal';
