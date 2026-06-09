/**
 * Agentic critic re-verification (docs/05 §3: "an agentic critic re-checks
 * low-confidence regions/cells and self-corrects"). Pure helpers — the second
 * AI call lives in the engine/pipeline; this owns the *which fields* + *how to
 * merge* logic so it stays testable.
 *
 * Strategy: after the first extraction, take the fields whose confidence is
 * below a threshold (or that are required-but-missing), re-extract ONLY those
 * with a focused prompt, then merge per-field keeping the higher-confidence
 * value. This is cheaper and more accurate than re-running the whole doc.
 */

import type {
  ConfidenceMap,
  ExtractionResult,
  ExtractionSchema,
} from './types';
import { computeOverallConfidence } from './confidence';

/** Field keys worth a second look: below threshold, or required-but-missing. */
export function lowConfidenceFields(
  schema: ExtractionSchema,
  result: ExtractionResult,
  threshold: number,
): string[] {
  const keys: string[] = [];
  for (const field of schema.fields) {
    const present =
      field.key in result.fields &&
      result.fields[field.key] !== null &&
      result.fields[field.key] !== '';
    const score = result.confidence[field.key]?.confidence ?? 0;
    if (field.required && !present) {
      keys.push(field.key);
    } else if (present && score < threshold) {
      keys.push(field.key);
    }
  }
  return keys;
}

/** A reduced schema containing only the given field keys (for the focused re-pass). */
export function subSchema(
  schema: ExtractionSchema,
  fieldKeys: string[],
): ExtractionSchema {
  const set = new Set(fieldKeys);
  return { ...schema, fields: schema.fields.filter((f) => set.has(f.key)) };
}

/**
 * Merge a critic re-pass into the primary result. For each rechecked field, the
 * higher-confidence value wins (the critic only overrides when it's more sure).
 * Overall confidence is recomputed from the merged maps.
 */
export function mergeCritic(
  schema: ExtractionSchema,
  primary: ExtractionResult,
  critic: ExtractionResult,
): ExtractionResult {
  const fields = { ...primary.fields };
  const confidence: ConfidenceMap = { ...primary.confidence };

  for (const key of Object.keys(critic.fields)) {
    const criticScore = critic.confidence[key]?.confidence ?? 0;
    const primaryScore = primary.confidence[key]?.confidence ?? 0;
    const criticHasValue =
      critic.fields[key] !== null &&
      critic.fields[key] !== undefined &&
      critic.fields[key] !== '';
    // Override when the critic is strictly more confident, or fills a blank.
    if (criticHasValue && (criticScore > primaryScore || !(key in fields))) {
      fields[key] = critic.fields[key];
      confidence[key] = critic.confidence[key] ?? { confidence: criticScore };
    }
  }

  return {
    ...primary,
    fields,
    confidence,
    overallConfidence: computeOverallConfidence(schema, fields, confidence),
  };
}
