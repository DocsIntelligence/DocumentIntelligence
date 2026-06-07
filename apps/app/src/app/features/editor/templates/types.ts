export type PlaceholderType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'email';

export type PlaceholderOption = {
  value: string;
  label: string;
};

export type PlaceholderDef = {
  /** Key that appears as `{{key}}` inside the template HTML. */
  key: string;
  /** Human label shown in the form. */
  label: string;
  /** Input control type. */
  type: PlaceholderType;
  /** Helper text under the field. */
  hint?: string;
  /** Placeholder shown when the input is empty. */
  placeholder?: string;
  /** Initial value. */
  default?: string;
  /** Options for `type: 'select'`. */
  options?: PlaceholderOption[];
  /** Field renders full-width in the form. */
  wide?: boolean;
};

export type DocumentTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Emoji or short tag for the gallery card. */
  icon: string;
  /** Initial HTML (use `{{key}}` placeholders + `<div data-page-break></div>` for breaks). */
  html: string;
  placeholders: PlaceholderDef[];
};
