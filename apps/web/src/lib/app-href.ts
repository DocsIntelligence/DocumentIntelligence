import { WEB_ENV } from '../config';

export type AppDest = 'login' | 'register' | 'dashboard' | 'settings';

/**
 * Build a deep-link into the product app (apps/app, the React SPA). This
 * marketing site (apps/web) never hosts its own sign-in, sign-up or
 * authenticated pages — every one of those routes lives in apps/app, so
 * every CTA here goes there instead.
 *
 * When the visitor is already signed in, auth-entry destinations
 * (login/register) collapse to the dashboard so we never send an
 * authenticated visitor back to a sign-up form.
 */
export function appHref(
  dest: AppDest,
  authed = false,
  /** Relative in-app path to land on post-auth instead of /dashboard,
   *  carried through as `?next=` for apps/app to consume once signed in. */
  redirectTo?: string,
): string {
  const base = WEB_ENV.appUrl.replace(/\/$/, '');

  if (authed) {
    const path = redirectTo
      ? redirectTo.startsWith('/')
        ? redirectTo
        : `/${redirectTo}`
      : '/dashboard';
    return `${base}${path}`;
  }

  if (dest === 'dashboard' || dest === 'settings') return `${base}/${dest}`;

  const query = redirectTo
    ? `?next=${encodeURIComponent(redirectTo)}`
    : '';
  return `${base}/${dest}${query}`;
}
