const KEY = 'auth.redirectTo';

/**
 * Persist a post-auth destination across redirects. `sessionStorage`
 * survives a full-page round-trip (OAuth → external provider → API
 * callback → /auth/callback), unlike react-router's in-memory
 * `location.state`. Cleared on consume so re-login doesn't loop back to
 * a stale destination.
 *
 * Path is stored as written (e.g. "/documents/abc/edit?foo=1"). We
 * deliberately don't persist external URLs — only same-app paths — to
 * avoid open-redirect attacks if the value is ever set from query
 * params.
 */

export function setRedirectTarget(path: string | undefined | null): void {
  if (!path) return;
  if (!path.startsWith('/')) return; // must be same-app
  if (path === '/login' || path.startsWith('/login?')) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage disabled (private mode quirks) — non-fatal.
  }
}

export function peekRedirectTarget(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function consumeRedirectTarget(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}
