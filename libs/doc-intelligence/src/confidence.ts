/**
 * Confidence aggregation + review routing (docs/05 §3, §6). Confidence drives
 * the STP (straight-through processing) decision: high-confidence fields pass;
 * low-confidence or review-mandatory fields are routed to a human.
 */

import type {
  ConfidenceMap,
  ExtractionResult,
  ExtractionSchema,
  FieldValues,
} from './types';

export interface RoutingPolicy {
  /** A field below this needs review. */
  fieldThreshold: number;
  /** Overall below this routes the whole doc to review. */
  overallThreshold: number;
}

export const DEFAULT_ROUTING: RoutingPolicy = {
  fieldThreshold: 0.85,
  overallThreshold: 0.9,
};

/**
 * Overall confidence = the minimum confidence among **required** fields that
 * were actually extracted, blended with mean of all present fields. We weight
 * toward the weakest required field deliberately: a legal doc is only as
 * trustworthy as its least-certain load-bearing value.
 */
export function computeOverallConfidence(
  schema: ExtractionSchema,
  values: FieldValues,
  confidence: ConfidenceMap,
): number {
  const present = Object.keys(values).filter(
    (k) => values[k] !== undefined && values[k] !== null && values[k] !== '',
  );
  if (present.length === 0) return 0;

  const scores = present.map((k) => confidence[k]?.confidence ?? 0);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  const requiredKeys = schema.fields
    .filter((f) => f.required)
    .map((f) => f.key);
  const requiredScores = requiredKeys
    .filter((k) => present.includes(k))
    .map((k) => confidence[k]?.confidence ?? 0);
  // Any required field missing entirely caps the overall low.
  const missingRequired = requiredKeys.some((k) => !present.includes(k));
  const weakestRequired = requiredScores.length
    ? Math.min(...requiredScores)
    : mean;

  const blended = 0.5 * mean + 0.5 * weakestRequired;
  return missingRequired ? Math.min(blended, 0.5) : blended;
}

export interface ReviewDecision {
  needsReview: boolean;
  /** Field keys that triggered review (below threshold or review-mandatory). */
  flaggedFields: string[];
  reasons: string[];
}

export function decideReview(
  schema: ExtractionSchema,
  result: ExtractionResult,
  policy: RoutingPolicy = DEFAULT_ROUTING,
): ReviewDecision {
  const flaggedFields: string[] = [];
  const reasons: string[] = [];

  for (const field of schema.fields) {
    const present = field.key in result.fields;
    const score = result.confidence[field.key]?.confidence ?? 0;
    // A per-field threshold (authored as config-as-data) overrides the global.
    const threshold = field.fieldThreshold ?? policy.fieldThreshold;
    if (field.reviewMandatory && present) {
      flaggedFields.push(field.key);
    } else if (present && score < threshold) {
      flaggedFields.push(field.key);
    } else if (field.required && !present) {
      flaggedFields.push(field.key);
      reasons.push(`Required field "${field.key}" missing`);
    }
  }

  if (result.overallConfidence < policy.overallThreshold) {
    reasons.push(
      `Overall confidence ${result.overallConfidence.toFixed(2)} < ${policy.overallThreshold}`,
    );
  }

  return {
    needsReview: flaggedFields.length > 0 || reasons.length > 0,
    flaggedFields,
    reasons,
  };
}
