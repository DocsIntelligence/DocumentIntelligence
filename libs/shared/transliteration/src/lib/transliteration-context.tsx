import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { SupportedLanguage } from './languages';
import { SUPPORTED_LANGUAGES } from './languages';
import { transliterate, type TransliterationResult } from './transliterate';

export type TransliterationContextValue = {
  /** Whether transliteration is currently enabled */
  enabled: boolean;
  /** Toggle transliteration on/off */
  toggle: () => void;
  /** Set enabled state directly */
  setEnabled: (enabled: boolean) => void;
  /** Current target language */
  language: SupportedLanguage;
  /** Change the target language */
  setLanguage: (lang: SupportedLanguage) => void;
  /** Get transliteration suggestions for a word */
  getSuggestions: (word: string) => Promise<TransliterationResult>;
  /** Available languages */
  languages: typeof SUPPORTED_LANGUAGES;
};

const TransliterationContext =
  createContext<TransliterationContextValue | null>(null);

type TransliterationProviderProps = {
  children: React.ReactNode;
  /** Default language (defaults to 'hi') */
  defaultLanguage?: SupportedLanguage;
  /** Whether transliteration is enabled by default */
  defaultEnabled?: boolean;
};

export function TransliterationProvider({
  children,
  defaultLanguage = 'hi',
  defaultEnabled = false,
}: TransliterationProviderProps) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [language, setLanguage] = useState<SupportedLanguage>(defaultLanguage);

  // Simple cache to avoid redundant API calls
  const cacheRef = useRef<Map<string, TransliterationResult>>(new Map());

  const toggle = useCallback(() => setEnabled((prev) => !prev), []);

  const getSuggestions = useCallback(
    async (word: string): Promise<TransliterationResult> => {
      const cacheKey = `${language}:${word}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) return cached;

      const result = await transliterate(word, language);
      cacheRef.current.set(cacheKey, result);

      // Keep cache size bounded
      if (cacheRef.current.size > 500) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) cacheRef.current.delete(firstKey);
      }

      return result;
    },
    [language],
  );

  const value = useMemo<TransliterationContextValue>(
    () => ({
      enabled,
      toggle,
      setEnabled,
      language,
      setLanguage,
      getSuggestions,
      languages: SUPPORTED_LANGUAGES,
    }),
    [enabled, toggle, language, getSuggestions],
  );

  return (
    <TransliterationContext.Provider value={value}>
      {children}
    </TransliterationContext.Provider>
  );
}

export function useTransliteration(): TransliterationContextValue {
  const context = useContext(TransliterationContext);
  if (!context) {
    throw new Error(
      'useTransliteration must be used within a TransliterationProvider',
    );
  }
  return context;
}
