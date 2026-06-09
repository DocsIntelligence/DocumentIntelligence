/**
 * Build a JSON Schema from an ExtractionSchema (config-from-DB → prompts-from-
 * config, §5). The schema is fed to the provider's forced tool-use / structured-
 * output mode so the model emits schema-shaped JSON — no string parsing.
 *
 * The output is intentionally a *flat* object keyed by each field's `key`
 * (dot-paths kept verbatim as keys; we do NOT nest, so `landlord.name` is one
 * property). The convert mapper (§11.4) later expands keys onto bundle paths.
 */

import type { ExtractionField, ExtractionSchema } from './types';

type JsonSchemaNode = Record<string, unknown>;

function fieldNode(field: ExtractionField): JsonSchemaNode {
  const describe = (extra?: JsonSchemaNode): JsonSchemaNode => ({
    ...(field.description ? { description: field.description } : {}),
    ...(field.example ? { examples: [field.example] } : {}),
    ...extra,
  });

  switch (field.type) {
    case 'number':
    case 'currency':
      return describe({ type: 'number' });
    case 'boolean':
      return describe({ type: 'boolean' });
    case 'date':
      // String, not json-schema `format: date`, because Indian docs use
      // DD/MM/YYYY and similar — we keep the source format and normalize later.
      return describe({ type: 'string' });
    case 'enum':
      return describe({
        type: 'string',
        ...(field.enumValues?.length ? { enum: field.enumValues } : {}),
      });
    case 'table':
      return describe({
        type: 'array',
        items: {
          type: 'object',
          properties: Object.fromEntries(
            (field.columns ?? []).map((c) => [c.key, fieldNode(c)]),
          ),
          required: (field.columns ?? [])
            .filter((c) => c.required)
            .map((c) => c.key),
          additionalProperties: false,
        },
      });
    case 'string':
    default:
      return describe({ type: 'string' });
  }
}

export function buildJsonSchema(schema: ExtractionSchema): JsonSchemaNode {
  return {
    type: 'object',
    title: schema.key,
    ...(schema.description ? { description: schema.description } : {}),
    properties: Object.fromEntries(
      schema.fields.map((f) => [f.key, fieldNode(f)]),
    ),
    required: schema.fields.filter((f) => f.required).map((f) => f.key),
    additionalProperties: false,
  };
}

/**
 * The full tool schema the extraction engine forces the model to emit: values
 * under `fields`, plus sibling `field_confidence` (per-field 0..1) and
 * `field_provenance` (per-field page) maps. Asking for confidence inline is the
 * single-shot way to get per-field calibrated confidence (docs/05 §3); the
 * agentic critic re-check pass (§3) layers on top in Phase 1.
 */
export function buildExtractionToolSchema(
  schema: ExtractionSchema,
): JsonSchemaNode {
  const values = buildJsonSchema(schema);
  return {
    type: 'object',
    properties: {
      fields: values,
      field_confidence: {
        type: 'object',
        description:
          'For each field you filled, your confidence 0..1 that the value is exactly correct as written in the document.',
        additionalProperties: { type: 'number' },
      },
      field_provenance: {
        type: 'object',
        description:
          'For each field you filled, the 1-based page number it was read from.',
        additionalProperties: {
          type: 'object',
          properties: { page: { type: 'number' } },
          additionalProperties: false,
        },
      },
    },
    required: ['fields'],
    additionalProperties: false,
  };
}

/** A tiny JSON Schema for the classification step (returns a doctype key). */
export function buildClassificationSchema(
  candidateKeys: string[],
): JsonSchemaNode {
  return {
    type: 'object',
    properties: {
      documentTypeKey: {
        type: ['string', 'null'],
        enum: [...candidateKeys, null],
        description:
          'The matching document type key, or null if none of the candidates fit.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence 0..1 in the chosen key.',
      },
    },
    required: ['documentTypeKey', 'confidence'],
    additionalProperties: false,
  };
}
