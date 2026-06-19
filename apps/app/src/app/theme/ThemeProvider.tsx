import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Color palettes are an axis orthogonal to light/dark. `default` is the base
 *  `:root` theme (no attribute); others apply via `[data-theme]` in styles.css.
 *  Light-only for now — dark mode always uses the default dark tokens. */
export type Palette = 'default' | 'warm';

export const PALETTES: ReadonlyArray<{
  id: Palette;
  labelKey: string;
  fallback: string;
}> = [
  { id: 'default', labelKey: 'theme.paletteDefault', fallback: 'Default' },
  { id: 'warm', labelKey: 'theme.paletteWarm', fallback: 'Warm' },
];

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
  palette: Palette;
  setPalette: (p: Palette) => void;
}

const STORAGE_KEY = 'theme';
const PALETTE_KEY = 'theme.palette';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialPalette(): Palette {
  if (typeof window === 'undefined') return 'default';
  const stored = window.localStorage.getItem(PALETTE_KEY);
  return PALETTES.some((p) => p.id === stored) ? (stored as Palette) : 'default';
}

function applyPalette(palette: Palette) {
  const html = document.documentElement;
  if (palette === 'default') delete html.dataset.theme;
  else html.dataset.theme = palette;
}

function getInitialPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'system';
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

function apply(resolved: ResolvedTheme) {
  const html = document.documentElement;
  html.classList.toggle('dark', resolved === 'dark');
  html.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    getInitialPreference,
  );
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolve(getInitialPreference()),
  );
  const [palette, setPaletteState] = useState<Palette>(getInitialPalette);

  useEffect(() => {
    const next = resolve(preference);
    setResolved(next);
    apply(next);
  }, [preference]);

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = mq.matches ? 'dark' : 'light';
      setResolved(next);
      apply(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    if (p === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, p);
  }, []);

  const setPalette = useCallback((p: Palette) => {
    setPaletteState(p);
    if (p === 'default') window.localStorage.removeItem(PALETTE_KEY);
    else window.localStorage.setItem(PALETTE_KEY, p);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, palette, setPalette }),
    [preference, resolved, setPreference, palette, setPalette],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
