import { useTranslation } from 'react-i18next';
import { cn } from '@org/utils';
import { type ThemePreference, useTheme } from './ThemeProvider';

const OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  labelKey: string;
  fallback: string;
}> = [
  { value: 'light', labelKey: 'theme.light', fallback: 'Light' },
  { value: 'system', labelKey: 'theme.system', fallback: 'System' },
  { value: 'dark', labelKey: 'theme.dark', fallback: 'Dark' },
];

/**
 * Segmented Light / System / Dark switcher. Stores user preference in
 * localStorage and falls back to OS pref when set to System.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t('theme.label', 'Theme')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5',
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(opt.labelKey, opt.fallback)}
            onClick={() => setPreference(opt.value)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'hover:text-foreground',
            )}
          >
            {opt.value === 'light' && <SunIcon />}
            {opt.value === 'system' && <MonitorIcon />}
            {opt.value === 'dark' && <MoonIcon />}
            <span className="sr-only">{t(opt.labelKey, opt.fallback)}</span>
          </button>
        );
      })}
    </div>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
