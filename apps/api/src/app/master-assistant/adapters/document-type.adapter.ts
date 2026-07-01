import { Injectable } from '@nestjs/common';
import type { JsonSchema } from '../../ai/providers/ai-provider.interface';
import type {
  UpdateExtractionSchemaDto,
  UpsertExtractionSchemaDto,
} from '../../intelligence-admin/intelligence-admin.dto';
import { IntelligenceAdminService } from '../../intelligence-admin/intelligence-admin.service';
import {
  normalizeKey,
  type MasterAdapter,
  type MasterRecordPlan,
} from '../master-adapter';

const FIELD_TYPES = [
  'string',
  'number',
  'currency',
  'date',
  'boolean',
  'enum',
  'table',
] as const;

interface AiSchemaField {
  key: string;
  label: string;
  type: (typeof FIELD_TYPES)[number];
  required?: boolean;
  description?: string;
  example?: string;
  enumValues?: string[];
}
interface AiDocTypeRecord {
  key: string;
  name: string;
  documentTypeKey?: string;
  description?: string;
  jurisdiction?: string;
  fields: AiSchemaField[];
}

/**
 * Master adapter for document types (extraction schemas + their fields).
 * Natural key = schema `key`. Create mints version 1; update mints a new
 * version of an existing schema.
 */
@Injectable()
export class DocumentTypeMasterAdapter implements MasterAdapter {
  readonly key = 'document-type';
  readonly label = 'Document types';
  readonly description =
    'Create or extend a document type (extraction schema) and its fields from a description.';

  readonly recordsSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      records: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            key: {
              type: 'string',
              description: 'Stable machine key, lower_snake_case (e.g. "rent_agreement").',
            },
            name: { type: 'string' },
            documentTypeKey: { type: 'string' },
            description: { type: 'string' },
            jurisdiction: {
              type: 'string',
              description: 'e.g. "IN" for India.',
            },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  key: { type: 'string', description: 'lower_snake_case field key.' },
                  label: { type: 'string' },
                  type: { type: 'string', enum: FIELD_TYPES as unknown as string[] },
                  required: { type: 'boolean' },
                  description: { type: 'string' },
                  example: { type: 'string' },
                  enumValues: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Allowed values — only when type is "enum".',
                  },
                },
                required: ['key', 'label', 'type'],
              },
            },
          },
          required: ['key', 'name', 'fields'],
        },
      },
    },
    required: ['records'],
  };

  readonly systemPrompt = [
    'You author DOCUMENT TYPE definitions (extraction schemas) for an India-first',
    'legal-document platform. A document type has a key + name and a list of typed',
    'fields to capture from such a document.',
    'Rules:',
    '- `key` and each field `key` are lower_snake_case and stable.',
    '- Choose the narrowest field `type`: string | number | currency | date | boolean | enum | table.',
    '- Use `enum` only with a concrete `enumValues` list. Default `jurisdiction` to "IN" unless told otherwise.',
    '- Mark a field `required: true` only when it is genuinely mandatory.',
    'Return only the structured records.',
  ].join('\n');

  constructor(private readonly admin: IntelligenceAdminService) {}

  async plan(aiData: unknown): Promise<MasterRecordPlan[]> {
    const records = (aiData as { records?: AiDocTypeRecord[] })?.records ?? [];
    const existing = await this.admin.listSchemas(true);
    const keys = new Set(existing.map((s) => s.key));

    return Promise.all(
      records.map(async (rec) => {
        const isUpdate = keys.has(rec.key);
        // Drop within-batch duplicate fields (normalized key), keep first.
        const incoming = dedupeFields(rec.fields ?? []);
        rec.fields = incoming;

        if (!isUpdate) {
          return {
            ref: `document-type:${rec.key}`,
            label: `${rec.name} (${rec.key})`,
            action: 'create' as const,
            note: `${incoming.length} field(s)`,
            record: rec,
          };
        }

        // Update: compare against existing fields (normalized key) so the note
        // and duplicate flag reflect real net change.
        const current = await this.admin.getSchema(rec.key);
        const have = new Map(
          current.fields.map((f) => [normalizeKey(f.key), f]),
        );
        let added = 0;
        let changed = 0;
        for (const f of incoming) {
          const cur = have.get(normalizeKey(f.key));
          if (!cur) added++;
          else if (cur.label !== f.label || cur.type !== f.type) changed++;
        }
        const duplicate = added === 0 && changed === 0;
        const note = duplicate
          ? 'all proposed fields already exist — nothing to change'
          : [added > 0 && `adds ${added}`, changed > 0 && `updates ${changed}`]
              .filter(Boolean)
              .join(', ') + ' field(s) (keeps the rest)';

        return {
          ref: `document-type:${rec.key}`,
          label: `${rec.name} (${rec.key})`,
          action: 'update' as const,
          note,
          duplicate,
          record: rec,
        };
      }),
    );
  }

  async commit(record: unknown): Promise<void> {
    const rec = record as AiDocTypeRecord;
    const incoming = dedupeFields(rec.fields ?? []).map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required ?? false,
      description: f.description ?? null,
      example: f.example ?? null,
      enumValues: f.enumValues ?? [],
    }));
    const existing = await this.admin.listSchemas(true);
    const exists = existing.some((s) => s.key === rec.key);

    if (exists) {
      // updateSchema mints a NEW version from exactly the fields we pass, so we
      // MERGE: keep existing fields, overwrite ones the prompt redefines (by
      // normalized key), append new ones. Non-destructive, no formatting dupes.
      const current = await this.admin.getSchema(rec.key);
      const incomingByKey = new Map(
        incoming.map((f) => [normalizeKey(f.key), f]),
      );
      const merged = [
        ...current.fields.map((f) => incomingByKey.get(normalizeKey(f.key)) ?? f),
        ...incoming.filter(
          (f) =>
            !current.fields.some(
              (e) => normalizeKey(e.key) === normalizeKey(f.key),
            ),
        ),
      ];
      const payload = {
        name: rec.name || current.name,
        documentTypeKey: rec.documentTypeKey ?? current.documentTypeKey ?? null,
        description: rec.description ?? current.description ?? null,
        jurisdiction: rec.jurisdiction ?? current.jurisdiction ?? 'IN',
        fields: merged,
      } as unknown as UpdateExtractionSchemaDto;
      await this.admin.updateSchema(rec.key, payload);
      return;
    }

    const payload = {
      key: rec.key,
      name: rec.name,
      documentTypeKey: rec.documentTypeKey ?? null,
      description: rec.description ?? null,
      jurisdiction: rec.jurisdiction ?? 'IN',
      fields: incoming,
    } as unknown as UpsertExtractionSchemaDto;
    await this.admin.createSchema(payload);
  }
}

/** Drop within-batch duplicate fields (normalized key), keeping the first. */
function dedupeFields(fields: AiSchemaField[]): AiSchemaField[] {
  const seen = new Set<string>();
  const out: AiSchemaField[] = [];
  for (const f of fields) {
    if (!f?.key) continue;
    const k = normalizeKey(f.key);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}
