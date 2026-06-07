export { RichTextEditor, type RichTextEditorProps } from './rich-text-editor';
export { DocumentEditor, type DocumentEditorProps } from './document-editor';
export {
  TransliterationExtension,
  type TransliterationState,
  type TransliterationExtensionOptions,
} from './transliteration-extension';
export { TransliterationToolbar } from './transliteration-toolbar';
export {
  SuggestionPopover,
  type SuggestionPopoverProps,
} from './suggestion-popover';
export { PageBreakExtension } from './page-break-extension';
export {
  PlaceholderHighlightExtension,
  type PlaceholderHighlightOptions,
  extractPlaceholderKeys,
  renderTemplateHtml,
  PLACEHOLDER_REGEX,
  PLACEHOLDER_HIGHLIGHT_META,
} from './placeholder-highlight-extension';
