import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and re-render when it changes.
 *
 * SSR-safe: returns `false` until mounted (no `window` during render on the
 * server). Use for layout decisions that can't be expressed with Tailwind
 * responsive classes alone — e.g. swapping a resizable multi-pane layout for a
 * single-pane mobile view.
 *
 * @example
 *   const isDesktop = useMediaQuery('(min-width: 1024px)'); // Tailwind `lg`
 */
export function useMediaQuery(query: string): boolean {
  // Initialise synchronously when a DOM is present (no flash / double mount on
  // the client); falls back to `false` during SSR where `window` is absent.
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
