import type { HttpClient } from './http';

/**
 * AI-assisted master setup: turn a natural-language prompt into create/update
 * records for a config master (lookups, document types, legal references), with
 * a preview-then-commit flow. Backed by /master-assistant/*.
 */

export type MasterAction = 'create' | 'update';

/** A master that supports AI-assisted upsert. */
export interface MasterSummary {
  key: string;
  label: string;
  description: string;
}

/** One proposed record in a plan (preview row). */
export interface MasterRecordPlan {
  ref: string;
  label: string;
  action: MasterAction;
  note?: string;
  /** True when applying this record would make no net change (all duplicates). */
  duplicate?: boolean;
  record: unknown;
}

export interface MasterPlanResult {
  planId: string;
  masterKey: string;
  model: string;
  plans: MasterRecordPlan[];
}

export interface MasterCommitResult {
  ref: string;
  action: MasterAction;
  ok: boolean;
  error?: string;
}

export interface MasterCommitSummary {
  created: number;
  updated: number;
  failed: number;
  results: MasterCommitResult[];
}

export const createMasterAssistantService = (http: HttpClient) => ({
  /** Masters that support AI-assisted upsert. */
  listMasters: () =>
    http.get<MasterSummary[]>('/master-assistant/masters').then((r) => r.data),

  /**
   * Generate a reviewable create/update plan from a prompt (writes nothing).
   * Pass `context` (e.g. { groupKey, groupName }) to scope to an existing
   * record — the plan then only adds to that target.
   */
  plan: (
    masterKey: string,
    prompt: string,
    context?: Record<string, string>,
  ) =>
    http
      .post<MasterPlanResult>('/master-assistant/plan', {
        masterKey,
        prompt,
        context,
      })
      .then((r) => r.data),

  /**
   * Commit a staged plan — optionally only the selected record refs, with
   * optional per-ref edited payloads (ref → record) from the review step.
   */
  commit: (
    planId: string,
    refs?: string[],
    edits?: Record<string, unknown>,
  ) =>
    http
      .post<MasterCommitSummary>('/master-assistant/commit', {
        planId,
        refs,
        edits,
      })
      .then((r) => r.data),
});

export type MasterAssistantService = ReturnType<
  typeof createMasterAssistantService
>;
