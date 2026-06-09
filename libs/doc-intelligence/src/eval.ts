/**
 * Evaluation & confidence harness (docs/05 §6) — "the POC's missing crown
 * jewel". Pure scorers over a gold fixture set: precision / recall / F1,
 * exact vs fuzzy match, table-cell accuracy, and the STP (straight-through)
 * rate. Calibration (reliability curves) is also computed here so thresholds
 * can be tuned until a reported 0.9 is right ~90% of the time.
 *
 * No model calls here — feed it predicted vs gold and it returns numbers. The
 * API/CLI wires it to real fixtures; this stays unit-testable.
 */

import type {
  ConfidenceMap,
  ExtractionSchema,
  FieldValues,
} from './types';

export interface GoldFixture {
  /** Stable id of the source doc (anonymized). */
  id: string;
  schemaKey: string;
  /** Ground-truth values, keyed exactly like ExtractionSchema field keys. */
  expected: FieldValues;
}

export interface Prediction {
  id: string;
  schemaKey: string;
  fields: FieldValues;
  confidence: ConfidenceMap;
}

// ─── Matching ────────────────────────────────────────────────────────────────

function normalizeScalar(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function exactMatch(a: unknown, b: unknown): boolean {
  return normalizeScalar(a) === normalizeScalar(b);
}

/** Levenshtein-ratio fuzzy match in [0,1]; `>= threshold` counts as a hit. */
export function fuzzyRatio(a: unknown, b: unknown): number {
  const s = normalizeScalar(a);
  const t = normalizeScalar(b);
  if (!s && !t) return 1;
  if (!s || !t) return 0;
  const m = s.length;
  const n = t.length;
  const d: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = d[j];
      d[j] = Math.min(
        d[j] + 1,
        d[j - 1] + 1,
        prev + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  const dist = d[n];
  return 1 - dist / Math.max(m, n);
}

// ─── Per-field metrics ────────────────────────────────────────────────────────

export interface FieldMetrics {
  /** TP: predicted present AND matches gold. */
  truePositives: number;
  /** FP: predicted present but wrong (or gold absent). */
  falsePositives: number;
  /** FN: gold present but not predicted (or mismatched). */
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvalOptions {
  /** Fuzzy threshold for a "match"; default 1 (exact). */
  fuzzyThreshold?: number;
}

function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

/** Score one field across the fixture set. */
export function scoreField(
  fieldKey: string,
  fixtures: GoldFixture[],
  predictions: Map<string, Prediction>,
  opts: EvalOptions = {},
): FieldMetrics {
  const threshold = opts.fuzzyThreshold ?? 1;
  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const fx of fixtures) {
    const pred = predictions.get(fx.id);
    const expected = fx.expected[fieldKey];
    const predicted = pred?.fields[fieldKey];
    const expectedPresent = present(expected);
    const predictedPresent = present(predicted);

    if (!expectedPresent && !predictedPresent) continue; // true negative
    if (predictedPresent && expectedPresent) {
      const hit =
        threshold >= 1
          ? exactMatch(predicted, expected)
          : fuzzyRatio(predicted, expected) >= threshold;
      if (hit) tp++;
      else {
        fp++;
        fn++;
      }
    } else if (predictedPresent && !expectedPresent) {
      fp++;
    } else {
      fn++;
    }
  }

  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);
  const f1 = safeDiv(2 * precision * recall, precision + recall);
  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
  };
}

export interface SchemaEvalReport {
  schemaKey: string;
  fixtureCount: number;
  perField: Record<string, FieldMetrics>;
  /** Macro-averaged across fields. */
  macroF1: number;
  /** Mean exact-match accuracy across all field cells. */
  cellAccuracy: number;
  /** STP rate: fixtures whose overall confidence cleared the threshold. */
  stpRate: number;
  /** Calibration buckets (reliability curve input). */
  calibration: CalibrationBucket[];
}

export interface CalibrationBucket {
  /** Bucket lower bound, e.g. 0.8 for the [0.8,0.9) bucket. */
  bucket: number;
  count: number;
  /** Mean reported confidence in this bucket. */
  meanConfidence: number;
  /** Observed accuracy in this bucket (should ≈ meanConfidence if calibrated). */
  observedAccuracy: number;
}

export function buildCalibration(
  fixtures: GoldFixture[],
  predictions: Map<string, Prediction>,
  fieldKeys: string[],
  bucketSize = 0.1,
): CalibrationBucket[] {
  const buckets = new Map<number, { conf: number[]; correct: number }>();
  for (const fx of fixtures) {
    const pred = predictions.get(fx.id);
    if (!pred) continue;
    for (const key of fieldKeys) {
      const c = pred.confidence[key]?.confidence;
      if (c === undefined) continue;
      const b = Math.min(0.9, Math.floor(c / bucketSize) * bucketSize);
      const entry = buckets.get(b) ?? { conf: [], correct: 0 };
      entry.conf.push(c);
      if (exactMatch(pred.fields[key], fx.expected[key])) entry.correct++;
      buckets.set(b, entry);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucket, e]) => ({
      bucket,
      count: e.conf.length,
      meanConfidence: e.conf.reduce((a, b) => a + b, 0) / e.conf.length,
      observedAccuracy: e.correct / e.conf.length,
    }));
}

export function evaluateSchema(
  schema: ExtractionSchema,
  fixtures: GoldFixture[],
  predictionList: Prediction[],
  opts: EvalOptions & { stpThreshold?: number } = {},
): SchemaEvalReport {
  const predictions = new Map(predictionList.map((p) => [p.id, p]));
  const relevant = fixtures.filter((f) => f.schemaKey === schema.key);
  const fieldKeys = schema.fields.map((f) => f.key);

  const perField: Record<string, FieldMetrics> = {};
  for (const key of fieldKeys) {
    perField[key] = scoreField(key, relevant, predictions, opts);
  }

  const f1s = fieldKeys.map((k) => perField[k].f1);
  const macroF1 = f1s.length
    ? f1s.reduce((a, b) => a + b, 0) / f1s.length
    : 0;

  // Cell accuracy across every (fixture × field) pair.
  let cells = 0;
  let correct = 0;
  let stpPass = 0;
  const stpThreshold = opts.stpThreshold ?? 0.9;
  for (const fx of relevant) {
    const pred = predictions.get(fx.id);
    for (const key of fieldKeys) {
      cells++;
      if (pred && exactMatch(pred.fields[key], fx.expected[key])) correct++;
    }
    // STP: a fixture is straight-through if every field's confidence cleared
    // the threshold (proxy — the real overall lives on the Extraction row).
    if (pred) {
      const allClear = fieldKeys.every(
        (k) => (pred.confidence[k]?.confidence ?? 0) >= stpThreshold,
      );
      if (allClear) stpPass++;
    }
  }

  return {
    schemaKey: schema.key,
    fixtureCount: relevant.length,
    perField,
    macroF1,
    cellAccuracy: safeDiv(correct, cells),
    stpRate: safeDiv(stpPass, relevant.length),
    calibration: buildCalibration(relevant, predictions, fieldKeys),
  };
}
