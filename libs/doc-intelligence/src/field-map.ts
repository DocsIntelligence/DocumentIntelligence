/**
 * The convert field-map (docs/05 §11.4) — config-as-data. Maps an extraction
 * field key → the drafting bundle's field path, so a reviewed extraction can be
 * mapped onto a `DocumentTypeBundle`'s Zod shape and handed to the public
 * document-create API (§11.3). Data, not code: new doc types get a field-map
 * without touching convert logic.
 *
 * A path is a dot-path into the bundle data object; array indices are written
 * `parties.0.name`. `applyFieldMap` deep-sets each mapped key, producing the
 * nested `data` object the builder expects.
 */

import type { FieldValues } from './types';

export interface FieldMap {
  /** The ExtractionSchema this maps from (its `key`). */
  schemaKey: string;
  /** The target `DocumentType.key` (§11.2). */
  documentTypeKey: string;
  /** ISO yyyy-mm-dd; versioned alongside the schema/bundle. */
  version: string;
  /** extractionFieldKey → bundle dot-path. */
  mapping: Record<string, string>;
}

function deepSet(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.');
  let node: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = parts[i + 1];
    const childIsArrayIndex = /^\d+$/.test(next);
    if (node[key] === undefined || node[key] === null) {
      node[key] = childIsArrayIndex ? [] : {};
    }
    node = node[key] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

/**
 * Apply a field-map to extracted values → nested bundle `data`. Unmapped
 * extraction keys are dropped (they have no home in the structured type); the
 * caller decides whether that's acceptable or should fall back to freeform.
 */
export function applyFieldMap(
  values: FieldValues,
  map: FieldMap,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [extractionKey, bundlePath] of Object.entries(map.mapping)) {
    const value = values[extractionKey];
    if (value === undefined || value === null || value === '') continue;
    deepSet(data, bundlePath, value);
  }
  return data;
}

/** Keys present in the extraction but absent from the map (convert-loss audit). */
export function unmappedKeys(values: FieldValues, map: FieldMap): string[] {
  return Object.keys(values).filter((k) => !(k in map.mapping));
}
