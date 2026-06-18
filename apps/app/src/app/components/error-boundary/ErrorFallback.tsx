import { Button } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * Themed fallback shown by {@link ErrorBoundary}. Recoverable: "Try again"
 * re-renders the subtree (after a transient error), "Reload" does a hard
 * refresh, and (route level) a link back to the dashboard.
 */
export function ErrorFallback({
  error,
  reset,
  level,
}: {
  error: Error;
  reset: () => void;
  level: 'app' | 'route';
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-error/30 text-error">
        <svg
          className="size-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
      <div className="max-w-md space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {t('errors.title', 'Something went wrong')}
        </h2>
        <p className="text-sm text-foreground/60">
          {t(
            'errors.body',
            'This part of the app ran into an unexpected error. You can try again, or reload the page.',
          )}
        </p>
        {error?.message && (
          <p className="break-words pt-1 font-mono text-xs text-foreground/45">
            {error.message}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>{t('errors.tryAgain', 'Try again')}</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t('errors.reload', 'Reload page')}
        </Button>
        {level === 'route' && (
          <Button asChild variant="ghost">
            <Link to="/dashboard">{t('errors.goHome', 'Go to dashboard')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
