import { Injectable } from '@nestjs/common';
import type { JsonSchema } from '../../ai/providers/ai-provider.interface';
import { LookupService } from '../../lookup/lookup.service';
import {
  normalizeKey,
  type MasterAdapter,
  type MasterRecordPlan,
} from '../master-adapter';

/** One value inside a lookup group, as the AI emits it. */
interface AiLookupValue {
  label: string;
  value: string;
}
/** One lookup group record, as the AI emits it. */
interface AiLookupRecord {
  key: string;
  name: string;
  description?: string;
  isPublic?: boolean;
  values: AiLookupValue[];
}

/**
 * Master adapter for lookup groups + their values. Natural key = group `key`.
 * On update we keep existing values and only append ones whose `value` is new
 * (values are unique per group), plus refresh the group's metadata.
 */
@Injectable()
export class LookupMasterAdapter implements MasterAdapter {
  readonly key = 'lookup';
  readonly label = 'Lookups';
  readonly description =
    'Create lookup groups and their option values (e.g. Indian states, document statuses).';

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
              description:
                'Stable machine key, lower_snake_case (e.g. "indian_states").',
            },
            name: { type: 'string', description: 'Human-readable group name.' },
            description: { type: 'string' },
            isPublic: { type: 'boolean' },
            values: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  label: { type: 'string', description: 'Display text.' },
                  value: {
                    type: 'string',
                    description: 'Stored value (stable, machine-friendly).',
                  },
                },
                required: ['label', 'value'],
              },
            },
          },
          required: ['key', 'name', 'values'],
        },
      },
    },
    required: ['records'],
  };

  readonly systemPrompt = [
    'You author LOOKUP master data for a legal-document platform.',
    'A lookup is a named group (key + name) holding option values (label + value).',
    'Rules:',
    '- `key` is lower_snake_case and stable; `value` is machine-friendly (lower_snake_case or a short code), `label` is human-readable.',
    '- Be exhaustive when the user asks for a known finite set (e.g. all Indian states + union territories).',
    '- Do not invent values the user did not ask for; do not duplicate values within a group.',
    'Return only the structured records.',
  ].join('\n');

  constructor(private readonly lookup: LookupService) {}

  async plan(
    aiData: unknown,
    context?: Record<string, string>,
  ): Promise<MasterRecordPlan[]> {
    let records = (aiData as { records?: AiLookupRecord[] })?.records ?? [];

    // Scoped to one group (from the group's own page): merge everything the AI
    // produced into a single record targeting that group, so the prompt only
    // appends values to it — deterministic regardless of what the model keyed.
    if (context?.groupKey) {
      records = [
        {
          key: context.groupKey,
          name: context.groupName ?? context.groupKey,
          values: records.flatMap((r) => r.values ?? []),
        },
      ];
    }

    const existing = await this.lookup.getAll();
    const byKey = new Map(existing.map((g) => [g.key, g]));

    return records.map((rec) => {
      const current = byKey.get(rec.key);
      const action = current ? 'update' : 'create';
      // Drop within-batch duplicates the model may have emitted (normalized),
      // and rewrite the record so commit works on the clean set.
      const deduped = dedupeValues(rec.values ?? []);
      rec.values = deduped;

      const have = new Map(
        (current?.values ?? []).map((v) => [normalizeKey(v.value ?? ''), v]),
      );
      let added = 0;
      let changed = 0;
      for (const v of deduped) {
        const cur = have.get(normalizeKey(v.value));
        if (!cur) added++;
        else if (cur.label !== v.label) changed++;
      }
      const dupSkipped = deduped.length - added - changed;

      let note: string;
      let duplicate = false;
      if (current) {
        const bits = [
          added > 0 && `adds ${added}`,
          changed > 0 && `updates ${changed}`,
          dupSkipped > 0 && `${dupSkipped} already exist`,
        ].filter(Boolean);
        if (added === 0 && changed === 0) {
          duplicate = true;
          note =
            dupSkipped > 0
              ? `all ${dupSkipped} value(s) already exist — nothing to add`
              : 'no values proposed';
        } else {
          note = `${bits.join(', ')} value(s)`;
        }
      } else {
        note = `${deduped.length} value(s)`;
      }

      return {
        ref: `lookup:${rec.key}`,
        label: `${rec.name} (${rec.key})`,
        action,
        note,
        duplicate,
        record: rec,
      };
    });
  }

  /** Existing values for a scoped group, so the model doesn't re-propose them. */
  async contextPrompt(
    context?: Record<string, string>,
  ): Promise<string | undefined> {
    if (!context?.groupKey) return undefined;
    const group = await this.lookup.getByKey(context.groupKey).catch(() => null);
    if (!group || group.values.length === 0) return undefined;
    const sample = group.values
      .slice(0, 200)
      .map((v) => v.label)
      .join(', ');
    return `\n\nThis group ALREADY contains these values — do NOT propose any of them again (match case- and spacing-insensitively): ${sample}.`;
  }

  async commit(record: unknown): Promise<void> {
    const rec = record as AiLookupRecord;
    const group = await this.lookup.getByKey(rec.key).catch(() => null);

    if (!group) {
      const created = await this.lookup.createGroup({
        key: rec.key,
        name: rec.name,
        description: rec.description,
        isPublic: rec.isPublic,
      });
      let order = 0;
      for (const v of rec.values ?? []) {
        await this.lookup.addValue(created.id, {
          label: v.label,
          value: v.value,
          order: order++,
        });
      }
      return;
    }

    await this.lookup.updateGroup(group.id, {
      name: rec.name,
      description: rec.description,
      isPublic: rec.isPublic,
    });
    const have = new Map(
      group.values.map((v) => [normalizeKey(v.value ?? ''), v]),
    );
    let order = group.values.length;
    for (const v of dedupeValues(rec.values ?? [])) {
      const cur = have.get(normalizeKey(v.value));
      if (!cur) {
        // Missing (normalized) → append.
        await this.lookup.addValue(group.id, {
          label: v.label,
          value: v.value,
          order: order++,
        });
      } else if (cur.label !== v.label) {
        // Same value, different label → update in place (no duplicate row).
        await this.lookup.updateValue(cur.id, { label: v.label });
      }
      // else: identical (normalized) → skip, never insert a formatting dupe.
    }
  }
}

/** Drop within-batch duplicate values (normalized), keeping the first seen. */
function dedupeValues(values: AiLookupValue[]): AiLookupValue[] {
  const seen = new Set<string>();
  const out: AiLookupValue[] = [];
  for (const v of values) {
    if (!v?.value) continue;
    const k = normalizeKey(v.value);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ label: v.label, value: v.value });
  }
  return out;
}
