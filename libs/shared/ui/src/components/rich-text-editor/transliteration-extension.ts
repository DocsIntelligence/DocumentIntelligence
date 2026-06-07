import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

import type { SupportedLanguage } from '@org/transliteration';
import { transliterate } from '@org/transliteration';

export type TransliterationState = {
  enabled: boolean;
  language: SupportedLanguage;
  /** Current word being typed (buffer) */
  buffer: string;
  /** Position where the current word started */
  bufferStart: number;
  /** Suggestions from the API */
  suggestions: string[];
  /** Whether the suggestion popover is visible */
  showSuggestions: boolean;
  /** Currently selected suggestion index */
  selectedIndex: number;
};

const TRANSLITERATION_PLUGIN_KEY = new PluginKey('transliteration');

// Characters that are part of a transliterable word
const WORD_CHAR = /[a-zA-Z]/;
// Characters that trigger transliteration (word boundaries)
const TRIGGER_CHARS = new Set([' ', '.', ',', '!', '?', ';', ':', '\n', '\t']);

export type TransliterationExtensionOptions = {
  /** Target language for transliteration */
  language: SupportedLanguage;
  /** Whether transliteration is enabled */
  enabled: boolean;
  /** Debounce delay for API calls in ms */
  debounceMs: number;
  /** Callback when suggestions are available */
  onSuggestions?: (state: TransliterationState) => void;
  /** Callback when suggestions are dismissed */
  onDismiss?: () => void;
};

export const TransliterationExtension =
  Extension.create<TransliterationExtensionOptions>({
    name: 'transliteration',

    addOptions() {
      return {
        language: 'hi' as SupportedLanguage,
        enabled: false,
        debounceMs: 150,
        onSuggestions: undefined,
        onDismiss: undefined,
      };
    },

    addStorage() {
      return {
        state: {
          enabled: this.options.enabled,
          language: this.options.language,
          buffer: '',
          bufferStart: 0,
          suggestions: [],
          showSuggestions: false,
          selectedIndex: 0,
        } as TransliterationState,
        debounceTimer: null as ReturnType<typeof setTimeout> | null,
      };
    },

    addProseMirrorPlugins() {
      const extension = this;

      return [
        new Plugin({
          key: TRANSLITERATION_PLUGIN_KEY,

          props: {
            handleKeyDown(view: EditorView, event: KeyboardEvent) {
              const storage = extension.storage;
              const state = storage.state as TransliterationState;

              if (!state.enabled) return false;

              // Handle suggestion navigation
              if (state.showSuggestions && state.suggestions.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  state.selectedIndex = Math.min(
                    state.selectedIndex + 1,
                    state.suggestions.length - 1,
                  );
                  extension.options.onSuggestions?.(state);
                  return true;
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
                  extension.options.onSuggestions?.(state);
                  return true;
                }

                // Enter or Tab selects the current suggestion
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault();
                  const selected = state.suggestions[state.selectedIndex];
                  if (selected) {
                    applySuggestion(view, state, selected);
                    resetBuffer(state);
                    extension.options.onDismiss?.();
                  }
                  return true;
                }

                // Number keys 1-5 select suggestion directly
                const num = parseInt(event.key);
                if (num >= 1 && num <= state.suggestions.length) {
                  event.preventDefault();
                  const selected = state.suggestions[num - 1];
                  if (selected) {
                    applySuggestion(view, state, selected);
                    resetBuffer(state);
                    extension.options.onDismiss?.();
                  }
                  return true;
                }

                // Escape dismisses suggestions
                if (event.key === 'Escape') {
                  event.preventDefault();
                  resetBuffer(state);
                  extension.options.onDismiss?.();
                  return true;
                }
              }

              // Space or punctuation triggers transliteration of the buffer
              if (TRIGGER_CHARS.has(event.key) && state.buffer.length > 0) {
                event.preventDefault();

                // If suggestions are showing, apply the first one
                if (state.showSuggestions && state.suggestions.length > 0) {
                  const selected =
                    state.suggestions[state.selectedIndex] ??
                    state.suggestions[0];
                  applySuggestion(view, state, selected + event.key);
                } else {
                  // Fetch and apply immediately
                  transliterate(state.buffer, state.language).then((result) => {
                    if (result.suggestions.length > 0) {
                      applySuggestion(
                        view,
                        state,
                        result.suggestions[0] + event.key,
                      );
                    } else {
                      // No suggestion — insert buffer as-is + trigger char
                      const { tr } = view.state;
                      tr.insertText(event.key);
                      view.dispatch(tr);
                    }
                  });
                }

                resetBuffer(state);
                extension.options.onDismiss?.();
                return true;
              }

              // Backspace removes from buffer
              if (event.key === 'Backspace' && state.buffer.length > 0) {
                state.buffer = state.buffer.slice(0, -1);
                if (state.buffer.length === 0) {
                  resetBuffer(state);
                  extension.options.onDismiss?.();
                } else {
                  debounceFetch(extension, state);
                }
                return false; // Let default backspace behavior happen
              }

              // Accumulate word characters into buffer
              if (event.key.length === 1 && WORD_CHAR.test(event.key)) {
                if (state.buffer.length === 0) {
                  const { from } = view.state.selection;
                  state.bufferStart = from;
                }
                state.buffer += event.key;
                debounceFetch(extension, state);
                return false; // Let the character be inserted normally
              }

              return false;
            },
          },
        }),
      ];
    },
  });

function applySuggestion(
  view: EditorView,
  state: TransliterationState,
  text: string,
) {
  const { tr } = view.state;
  // Replace the buffer range with the transliterated text
  tr.replaceWith(
    state.bufferStart,
    state.bufferStart + state.buffer.length,
    view.state.schema.text(text),
  );
  view.dispatch(tr);
}

function resetBuffer(state: TransliterationState) {
  state.buffer = '';
  state.bufferStart = 0;
  state.suggestions = [];
  state.showSuggestions = false;
  state.selectedIndex = 0;
}

function debounceFetch(
  extension: {
    storage: {
      debounceTimer: ReturnType<typeof setTimeout> | null;
      state: TransliterationState;
    };
    options: TransliterationExtensionOptions;
  },
  state: TransliterationState,
) {
  if (extension.storage.debounceTimer) {
    clearTimeout(extension.storage.debounceTimer);
  }

  extension.storage.debounceTimer = setTimeout(async () => {
    if (state.buffer.length < 2) return; // Don't fetch for single chars

    const result = await transliterate(state.buffer, state.language);
    if (result.suggestions.length > 0) {
      state.suggestions = result.suggestions;
      state.showSuggestions = true;
      state.selectedIndex = 0;
      extension.options.onSuggestions?.(state);
    }
  }, extension.options.debounceMs);
}
