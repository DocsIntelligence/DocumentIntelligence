/**
 * ExtractionSchema + FieldMap registry. Mirrors `@org/document-schema`'s
 * `_registry` (docs/05 §11.1): a Map keyed by schema key, with the parallel
 * field-maps that route a known type into its `DocumentTypeBundle` on convert.
 *
 * In production these are config-as-data rows in Postgres (§5); the in-code
 * registry seeds the first packs (rent/rti/notice) and is the source the API
 * falls back to when no DB override exists.
 */

import type { FieldMap } from '../field-map';
import type { ExtractionSchema } from '../types';

const schemas = new Map<string, ExtractionSchema>();
const fieldMaps = new Map<string, FieldMap>();

export function registerExtractionSchema(
  schema: ExtractionSchema,
  fieldMap?: FieldMap,
): void {
  if (schemas.has(schema.key) && schemas.get(schema.key) !== schema) {
    throw new Error(`ExtractionSchema "${schema.key}" registered twice`);
  }
  schemas.set(schema.key, schema);
  if (fieldMap) fieldMaps.set(schema.key, fieldMap);
}

export function getExtractionSchema(key: string): ExtractionSchema | undefined {
  return schemas.get(key);
}

export function getFieldMap(schemaKey: string): FieldMap | undefined {
  return fieldMaps.get(schemaKey);
}

export function listExtractionSchemaKeys(): string[] {
  return [...schemas.keys()];
}

/** Candidate `DocumentType.key`s the classifier may choose from (§11.2). */
export function classifierCandidateKeys(): string[] {
  return [...schemas.values()]
    .map((s) => s.documentTypeKey)
    .filter((k): k is string => Boolean(k));
}
