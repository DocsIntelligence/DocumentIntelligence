/**
 * Core Document-Intelligence types (docs/05). Pure data — no React, no NestJS,
 * no provider SDKs — so the engine, the eval harness, and the API module can
 * all share one vocabulary.
 *
 * `ExtractionSchema` is the **mirror image** of the drafting side's
 * `DocumentTypeBundle` (docs/05 §11.1): the bundle fills a *blank* document
 * into structured values; an ExtractionSchema reads a *filled* document back
 * into structured values. When an ExtractionSchema describes a known document
 * type, its `documentTypeKey` equals that bundle's `DocumentType.key` — the
 * single shared vocabulary that makes the Phase-3 convert bridge cheap.
 *
 * An ExtractionSchema is **config-as-data** (authored no-code, stored as jsonb,
 * versioned — §5.1), NOT a Zod schema. The Zod side stays on the drafting half.
 */

export type ExtractionFieldType =
  | 'string'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'table';

/** One field to extract. Dot-paths (`landlord.name`) are allowed in `key`. */
export interface ExtractionField {
  key: string;
  label: string;
  type: ExtractionFieldType;
  required?: boolean;
  /** Natural-language guidance that becomes part of the model's instruction. */
  description?: string;
  /** A representative value, to anchor the model (few-shot-ish). */
  example?: string;
  /** Format hint, e.g. "DD/MM/YYYY", "INR", "+91 ##########". */
  format?: string;
  /** Allowed values for `type: 'enum'`. */
  enumValues?: string[];
  /** Per-row column fields for `type: 'table'` (line-items, §3). */
  columns?: ExtractionField[];
  /** Force human review regardless of confidence (e.g. legally load-bearing). */
  reviewMandatory?: boolean;
  /** Per-field review threshold; overrides the routing policy's global one. */
  fieldThreshold?: number;
}

export interface ExtractionSchema {
  /** Schema key. Equals `DocumentType.key` when mirroring a known type. */
  key: string;
  name: string;
  /** ISO yyyy-mm-dd the schema was finalized; bump on change (regression gate). */
  version: string;
  /** The drafting `DocumentType.key` this maps to, when one exists (§11.2). */
  documentTypeKey?: string;
  description?: string;
  /** Jurisdiction variant tag, e.g. "IN-MH". */
  jurisdiction?: string;
  fields: ExtractionField[];
}

// ─── Normalized source (ingest output) ─────────────────────────────────────

export interface BBox {
  /** 1-based page number. */
  page: number;
  /** Normalized 0..1 coordinates (origin top-left). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ExtractionSource = 'native_text' | 'ocr' | 'vlm';

export interface TextBlock {
  text: string;
  bbox?: BBox;
}

export interface NormalizedPage {
  /** 1-based. */
  page: number;
  text: string;
  blocks?: TextBlock[];
}

export interface NormalizedDocument {
  pages: NormalizedPage[];
  /** Detected primary language (BCP-47-ish), e.g. "hi" / "en". */
  language?: string;
  /** Which path produced this (for provenance + eval breakdowns). */
  source?: ExtractionSource;
}

// ─── Confidence + provenance (every AI field, §1) ───────────────────────────

export interface Provenance {
  page?: number;
  bbox?: BBox;
  source?: ExtractionSource;
  /** The verbatim span the value was read from (audit/debug). */
  snippet?: string;
}

export interface FieldConfidence {
  /** Calibrated 0..1 (a 0.9 should be right ~90% of the time, §3). */
  confidence: number;
  provenance?: Provenance;
}

export type FieldValues = Record<string, unknown>;
export type ConfidenceMap = Record<string, FieldConfidence>;

// ─── Pipeline results ───────────────────────────────────────────────────────

export interface ClassificationCandidate {
  /** A generator `DocumentType.key`, or a schema key. */
  key: string;
  confidence: number;
}

export interface ClassificationResult {
  /** The matched `DocumentType.key`, or null when no known type matches. */
  documentTypeKey: string | null;
  confidence: number;
  candidates?: ClassificationCandidate[];
}

export interface ExtractionResult {
  schemaKey: string;
  documentTypeKey?: string;
  fields: FieldValues;
  confidence: ConfidenceMap;
  /** Aggregate 0..1 driving review routing / straight-through (STP). */
  overallConfidence: number;
}

/** A single recorded human correction (audit trail / active-learning signal). */
export interface FieldEdit {
  fieldPath: string;
  originalValue: unknown;
  newValue: unknown;
  editedBy: string;
  /** ISO timestamp. */
  at: string;
}
