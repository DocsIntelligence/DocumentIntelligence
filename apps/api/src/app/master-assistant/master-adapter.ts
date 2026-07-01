import type { JsonSchema } from '../ai/providers/ai-provider.interface';

/**
 * AI-assisted master setup (config-as-data). Each "master" (lookups, document
 * types, legal references) implements this adapter so the generic
 * MasterAssistant can: describe the record shape to the AI, turn the AI's
 * output into a reviewable create/update plan, and commit approved records by
 * delegating to that master's own service. Interface-first per
 * docs/ARCHITECTURE_PRINCIPLES — the assistant never talks to a master's tables
 * directly, only through its adapter.
 */

export type MasterAction = 'create' | 'update';

/**
 * Canonical form for duplicate detection — trims, lowercases and collapses
 * whitespace so "USD", " usd " and "U S D"→… are matched as the same key.
 * Used for lookup values, document-type field keys and citation ids so the
 * assistant never adds a differently-cased/spaced duplicate of what exists.
 */
export function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** One proposed record in a plan (preview row). */
export interface MasterRecordPlan {
  /** Stable natural-key ref — used for include/exclude at commit + dedup. */
  ref: string;
  /** Human label shown in the preview table. */
  label: string;
  action: MasterAction;
  /** One-line note (e.g. "adds 3 new values" for an update). */
  note?: string;
  /**
   * True when this record would make NO net change (everything proposed already
   * exists). The UI flags it and leaves it unselected so duplicates aren't
   * re-applied — the review "gate".
   */
  duplicate?: boolean;
  /** Adapter-specific upsert payload — echoed back verbatim at commit time. */
  record: unknown;
}

/** Outcome of committing one planned record. */
export interface MasterCommitResult {
  ref: string;
  action: MasterAction;
  ok: boolean;
  error?: string;
}

export interface MasterAdapter {
  /** Stable identifier, e.g. 'lookup' | 'document-type' | 'legal-reference'. */
  readonly key: string;
  /** Human label for the master selector / panel heading. */
  readonly label: string;
  /** Short description shown under the prompt box. */
  readonly description: string;
  /**
   * JSON Schema the AI must satisfy — always an object `{ records: [...] }` so
   * one prompt can yield several records.
   */
  readonly recordsSchema: JsonSchema;
  /** System prompt describing the master + its golden rules. */
  readonly systemPrompt: string;
  /**
   * Turn raw AI output into per-record plans, detecting create vs update
   * against what already exists. Reads only; writes nothing.
   *
   * `context` scopes the operation to an existing record — e.g. the lookup
   * adapter uses `{ groupKey, groupName }` to target one group so the prompt
   * only adds values to it (rather than authoring a new group).
   */
  plan(
    aiData: unknown,
    context?: Record<string, string>,
  ): Promise<MasterRecordPlan[]>;
  /**
   * Optional: extra text appended to the AI system prompt describing what
   * already exists (e.g. a scoped lookup group's current values) so the model
   * avoids re-proposing duplicates. Reads only.
   */
  contextPrompt?(context?: Record<string, string>): Promise<string | undefined>;
  /** Commit one planned record's payload via the master's own service. */
  commit(record: unknown): Promise<void>;
}
