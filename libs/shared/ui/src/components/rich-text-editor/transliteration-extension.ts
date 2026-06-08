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

// TipTap types `editor.storage` as the bare `Storage` interface, which — with
// no module-local declaration — otherwise resolves to the DOM `Storage`
// (localStorage), so `editor.storage.transliteration` fails to type-check.
// Declaring the interface inside the module gives extension storage a real
// shape and keeps it stable regardless of program composition.
declare module '@tiptap/core' {
  interface Storage {
    transliteration: TransliterationState;
    // Other extensions' storage is accessed only internally; index keeps
    // arbitrary `editor.storage[name]` lookups permissive.
    [key: string]: unknown;
  }
}

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
        enabled: this.options.enabled,
        language: this.options.language,
        buffer: '',
        bufferStart: 0,
        suggestions: [] as string[],
        showSuggestions: false,
        selectedIndex: 0,
        debounceTimer: null as ReturnType<typeof setTimeout> | null,
      };
    },

    addProseMirrorPlugins() {
      // Capture a reference to the editor instance so the plugin can access
      // extension storage via editor.storage.transliteration (the canonical
      // shared reference TipTap guarantees across re-renders).
      const editor = this.editor;
      const extensionOptions = this.options;

      return [
        new Plugin({
          key: TRANSLITERATION_PLUGIN_KEY,

          props: {
            handleKeyDown(view: EditorView, event: KeyboardEvent) {
              const state = editor.storage
                .transliteration as TransliterationState;

              if (!state.enabled) return false;

              // Handle suggestion navigation
              if (state.showSuggestions && state.suggestions.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  state.selectedIndex = Math.min(
                    state.selectedIndex + 1,
                    state.suggestions.length - 1,
                  );
                  extensionOptions.onSuggestions?.({ ...state });
                  return true;
                }

                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
                  extensionOptions.onSuggestions?.({ ...state });
                  return true;
                }

                // Enter or Tab selects the current suggestion
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault();
                  const selected = state.suggestions[state.selectedIndex];
                  if (selected) {
                    applySuggestion(view, state, selected);
                    resetBuffer(state);
                    extensionOptions.onDismiss?.();
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
                    extensionOptions.onDismiss?.();
                  }
                  return true;
                }

                // Escape dismisses suggestions
                if (event.key === 'Escape') {
                  event.preventDefault();
                  resetBuffer(state);
                  extensionOptions.onDismiss?.();
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
                  resetBuffer(state);
                  extensionOptions.onDismiss?.();
                } else {
                  // Capture buffer state before reset for the async path
                  const pendingBuffer = state.buffer;
                  const pendingStart = state.bufferStart;
                  const pendingLang = state.language;
                  resetBuffer(state);
                  extensionOptions.onDismiss?.();

                  // Fetch and apply
                  transliterate(pendingBuffer, pendingLang).then((result) => {
                    if (result.suggestions.length > 0) {
                      const { tr } = view.state;
                      tr.replaceWith(
                        pendingStart,
                        pendingStart + pendingBuffer.length,
                        view.state.schema.text(
                          result.suggestions[0] + event.key,
                        ),
                      );
                      view.dispatch(tr);
                    } else {
                      // No suggestion — just insert the trigger char
                      const { tr } = view.state;
                      tr.insertText(event.key);
                      view.dispatch(tr);
                    }
                  });
                }

                return true;
              }

              // Backspace removes from buffer
              if (event.key === 'Backspace' && state.buffer.length > 0) {
                state.buffer = state.buffer.slice(0, -1);
                if (state.buffer.length === 0) {
                  resetBuffer(state);
                  extensionOptions.onDismiss?.();
                } else {
                  debounceFetchFromState(state, extensionOptions);
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
                debounceFetchFromState(state, extensionOptions);
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

// Shared debounce timer stored directly on the state object
const debounceTimers = new WeakMap<object, ReturnType<typeof setTimeout>>();

function debounceFetchFromState(
  state: TransliterationState,
  options: TransliterationExtensionOptions,
) {
  const existing = debounceTimers.get(state);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    if (state.buffer.length < 2) return; // Don't fetch for single chars

    const result = await transliterate(state.buffer, state.language);
    if (result.suggestions.length > 0) {
      state.suggestions = result.suggestions;
      state.showSuggestions = true;
      state.selectedIndex = 0;
      options.onSuggestions?.({ ...state });
    }
  }, options.debounceMs);

  debounceTimers.set(state, timer);
}
