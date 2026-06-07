import { inspect } from 'node:util';

/**
 * Turn an unknown thrown value into a useful message string.
 *
 * `String(someObject)` yields the infamous "[object Object]", which is what
 * happens when a non-Error (a transport/SDK rejection, a plain object, an
 * AggregateError, etc.) is stringified. This handles those cases so stored
 * and logged errors stay diagnostic.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    try {
      return inspect(e, { depth: 3 });
    } catch {
      /* circular / un-inspectable — fall through */
    }
  }
  return String(e);
}

/** Full, multi-line detail for server logs (stack for Errors, deep inspect otherwise). */
export function errorDetail(e: unknown): string {
  if (e instanceof Error) return e.stack ?? `${e.name}: ${e.message}`;
  try {
    return inspect(e, { depth: 5 });
  } catch {
    return String(e);
  }
}
