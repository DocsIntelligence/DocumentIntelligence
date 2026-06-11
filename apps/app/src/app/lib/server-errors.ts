import { AxiosError } from 'axios';
import type {
  FieldValues,
  Path,
  UseFormSetError,
} from 'react-hook-form';

/**
 * The body the global `ZodValidationPipe` (nestjs-zod) returns on a 400. The
 * `errors`/`issues` array carries one entry per failed field with its `path`
 * (e.g. `['fields', 0, 'key']`) — we map those back onto the matching
 * react-hook-form fields so server-side validation surfaces inline at the
 * field, not just as a page-level toast.
 */
interface ZodIssueLike {
  path?: (string | number)[];
  message?: string;
}

function extractIssues(err: unknown): ZodIssueLike[] | null {
  if (!(err instanceof AxiosError)) return null;
  const data = err.response?.data as
    | { errors?: unknown; message?: unknown }
    | undefined;
  if (!data) return null;

  // nestjs-zod shapes seen across versions: `errors: Issue[]`,
  // `errors: { issues: Issue[] }`, or a flat `message: Issue[]`.
  const candidate =
    (Array.isArray(data.errors) && data.errors) ||
    (data.errors &&
      typeof data.errors === 'object' &&
      Array.isArray((data.errors as { issues?: unknown }).issues) &&
      (data.errors as { issues: unknown[] }).issues) ||
    (Array.isArray(data.message) && data.message) ||
    null;

  if (!candidate) return null;
  return (candidate as unknown[]).filter(
    (i): i is ZodIssueLike =>
      !!i && typeof i === 'object' && Array.isArray((i as ZodIssueLike).path),
  );
}

/**
 * Map a server validation 400 onto the form's fields. Returns `true` when at
 * least one field error was applied (so the caller can suppress its generic
 * toast), `false` otherwise (caller should fall back to a toast).
 */
export function applyServerFieldErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
): boolean {
  const issues = extractIssues(err);
  if (!issues || issues.length === 0) return false;

  let applied = 0;
  for (const issue of issues) {
    if (!issue.path || issue.path.length === 0) continue;
    const name = issue.path.join('.') as Path<T>;
    setError(name, {
      type: 'server',
      message: issue.message ?? 'Invalid value',
    });
    applied += 1;
  }
  return applied > 0;
}
