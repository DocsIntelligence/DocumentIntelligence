import type { z } from 'zod';

/**
 * Shared types for the document schema registry. The registry maps a
 * DocumentType key (e.g. "rent_agreement") to a bundle of:
 *   - a Zod schema describing form values
 *   - per-field UI metadata (label, helper, widget, AI prompt key, showIf)
 *   - deterministic risk rules
 *   - a versioned prompt manifest for legal-ai
 *   - a list of compatible template keys
 *
 * Templates live in `@org/document-templates`; the registry only knows
 * their keys, not their React implementations, to avoid a build-time
 * dependency from server-side validation onto React.
 */

export type FieldWidget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'currency'
  | 'phone'
  | 'aadhaar'
  | 'pan'
  | 'pincode'
  | 'address'
  | 'partyBlock'
  | 'witnessBlock'
  | 'lookup';

export type ShowIfClause =
  | { field: string; equals: unknown }
  | { field: string; in: unknown[] }
  | { field: string; gt?: number; lt?: number; gte?: number; lte?: number }
  | { allOf: ShowIfClause[] }
  | { anyOf: ShowIfClause[] };

export interface FieldMetadata {
  label: string;
  helperText?: string;
  widget?: FieldWidget;
  aiPromptKey?: string;
  showIf?: ShowIfClause;
  lookupKey?: string; // when widget === 'lookup', resolves via LookupGroup
  placeholder?: string;
}

export type FormMetadata = Record<string, FieldMetadata>;

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface Warning {
  id: string;
  severity: WarningSeverity;
  message: string;
  fieldPath?: string;
  /** Effective-date annotation of the rule that fired. ISO yyyy-mm-dd. */
  ruleVersion?: string;
}

export type RisksFunction<T = unknown> = (data: T) => Warning[];

export interface PromptDefinition {
  id: string;
  /** ISO date the prompt text was finalized. Bump when content changes. */
  version: string;
  /** Model alias resolved by legal-ai service (gpt-4o-mini, gemini-1.5-pro, …). */
  model: string;
  temperature?: number;
  system: string;
  /**
   * User-message template with {{handlebars}} placeholders. The placeholders
   * are filled by the legal-ai service from the request payload.
   */
  user: string;
}

export type PromptManifest = Record<string, PromptDefinition>;

export interface DocumentTypeBundle<T = unknown> {
  key: string;
  schema: z.ZodType<T>;
  formMetadata: FormMetadata;
  /** Order to render sections in the builder's left tree. */
  sectionOrder: string[];
  risks: RisksFunction<T>;
  prompts: PromptManifest;
  /** Template keys this DocumentType supports. Authoritative list lives in DB. */
  knownTemplates: string[];
}
