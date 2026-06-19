import { useTranslation } from 'react-i18next';
import { cn } from '@org/utils';
import { type Palette, PALETTES, useTheme } from './ThemeProvider';

/** Representative brand swatch per palette (mirrors the `--primary` token in
 *  styles.css) so each option previews its accent before selection. */
const SWATCH: Record<Palette, string> = {
  default: 'oklch(0.55 0.18 230)',
  warm: 'oklch(0.52 0.1 185)',
};

/**
 * Color-palette picker — an axis orthogonal to the light/dark ThemeToggle.
 * Persists via the ThemeProvider (localStorage) and applies through the
 * `data-theme` attribute. Scales to more palettes by adding to PALETTES.
 */
export function PaletteSwitch({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { palette, setPalette } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label={t('theme.paletteLabel', 'Color theme')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5',
        className,
      )}
    >
      {PALETTES.map((opt) => {
        const active = palette === opt.id;
        const label = t(opt.labelKey, opt.fallback);
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => setPalette(opt.id)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              active ? 'bg-background shadow-sm' : 'hover:bg-background/60',
            )}
          >
            <span
              className={cn(
                'size-3.5 rounded-full ring-1 ring-inset ring-black/10',
                active && 'ring-2 ring-foreground/70',
              )}
              style={{ backgroundColor: SWATCH[opt.id] }}
            />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
