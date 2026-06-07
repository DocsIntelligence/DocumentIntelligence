import type { SupportedLanguage } from './languages';

export type TransliterationResult = {
  input: string;
  suggestions: string[];
};

/**
 * Calls Google Input Tools transliteration API to get suggestions
 * for a given word in the target language.
 *
 * @param word - The romanized input word (e.g., "namaste")
 * @param lang - Target language code (e.g., "hi" for Hindi)
 * @param numSuggestions - Number of suggestions to fetch (default: 5)
 * @returns Array of transliterated suggestions
 */
export async function transliterate(
  word: string,
  lang: SupportedLanguage,
  numSuggestions = 5,
): Promise<TransliterationResult> {
  if (!word.trim()) {
    return { input: word, suggestions: [] };
  }

  const url = new URL('https://www.google.com/inputtools/request');
  url.searchParams.set('ime', `transliteration_en_${lang}`);
  url.searchParams.set('num', String(numSuggestions));
  url.searchParams.set('cp', '0');
  url.searchParams.set('cs', '0');
  url.searchParams.set('ie', 'utf-8');
  url.searchParams.set('oe', 'utf-8');
  url.searchParams.set('app', 'jsapi');
  url.searchParams.set('text', word);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(`[transliterate] API returned ${response.status}`);
      return { input: word, suggestions: [] };
    }

    const data = await response.json();

    // Response format: ["SUCCESS", [["input", ["suggestion1", "suggestion2", ...]]]]
    if (data[0] === 'SUCCESS' && data[1]?.[0]?.[1]) {
      return {
        input: word,
        suggestions: data[1][0][1] as string[],
      };
    }

    return { input: word, suggestions: [] };
  } catch (error) {
    console.warn('[transliterate] Failed to fetch suggestions:', error);
    return { input: word, suggestions: [] };
  }
}
