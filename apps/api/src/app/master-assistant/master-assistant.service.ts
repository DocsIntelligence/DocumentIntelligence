import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { errorMessage } from '../common/error.util';
import type { MasterCommitResult, MasterRecordPlan } from './master-adapter';
import { MasterAdapterRegistry } from './master-adapter.registry';

interface StagedPlan {
  masterKey: string;
  plans: MasterRecordPlan[];
  createdAt: number;
}

/** Staged plans live in memory for this long before GC (review then commit). */
const PLAN_TTL_MS = 30 * 60 * 1000;

/**
 * AI-assisted master setup: a prompt → structured records → reviewable
 * create/update plan → commit. Mirrors the statute-import stage→preview→commit
 * flow; writes nothing until `commit`. Generic over the adapter registry.
 */
@Injectable()
export class MasterAssistantService {
  private readonly logger = new Logger(MasterAssistantService.name);
  private readonly staged = new Map<string, StagedPlan>();

  constructor(
    private readonly ai: AiService,
    private readonly registry: MasterAdapterRegistry,
  ) {}

  listMasters() {
    return this.registry.list();
  }

  /** Run the prompt through the AI, diff against existing data, stage a plan. */
  async plan(
    masterKey: string,
    prompt: string,
    context?: Record<string, string>,
  ) {
    if (!prompt?.trim()) {
      throw new BadRequestException('A prompt is required.');
    }
    const adapter = this.registry.get(masterKey);

    // When scoped to an existing record (e.g. one lookup group), tell the model
    // to target it and only add to it — don't author siblings.
    const contextNote =
      context && Object.keys(context).length
        ? `\n\nScope: add to the EXISTING target ${JSON.stringify(
            context,
          )}. Generate items to ADD to it; do not rename it or create others.`
        : '';

    // Existing-items context so the model doesn't re-propose what's already
    // there (deduplication starts at the source, not just at commit time).
    const existingNote = adapter.contextPrompt
      ? ((await adapter.contextPrompt(context).catch(() => undefined)) ?? '')
      : '';
    const dedupeNote =
      '\n\nAvoid duplicates: do not propose an item that already exists (case- and spacing-insensitive). Keep formatting consistent with existing items.';

    const res = await this.ai.extract<unknown>(
      [{ kind: 'text', text: prompt.trim() }],
      adapter.recordsSchema,
      {
        systemPrompt: adapter.systemPrompt + contextNote + existingNote + dedupeNote,
        schemaName: `master_${masterKey.replace(/-/g, '_')}`,
        instruction: `Produce ${adapter.label} records for: ${prompt.trim()}`,
        maxTokens: 8000,
      },
    );

    const plans = await adapter.plan(res.data, context);
    if (plans.length === 0) {
      throw new BadRequestException(
        'The AI did not produce any records for this prompt. Try rephrasing.',
      );
    }

    this.gc();
    const planId = randomUUID();
    this.staged.set(planId, { masterKey, plans, createdAt: Date.now() });
    this.logger.log(
      `Planned ${plans.length} ${masterKey} record(s) (planId=${planId})`,
    );

    return { planId, masterKey, model: res.model, plans };
  }

  /**
   * Commit selected (or all) staged records; per-record errors are reported.
   * `edits` (ref → record) overrides the staged payload for records the user
   * tweaked in the review step.
   */
  async commit(
    planId: string,
    refs?: string[],
    edits?: Record<string, unknown>,
  ) {
    const staged = this.staged.get(planId);
    if (!staged) {
      throw new BadRequestException(
        'This plan has expired or was already applied — re-run the prompt.',
      );
    }
    const adapter = this.registry.get(staged.masterKey);
    const selected =
      refs && refs.length
        ? staged.plans.filter((p) => refs.includes(p.ref))
        : staged.plans;

    const results: MasterCommitResult[] = [];
    for (const plan of selected) {
      try {
        const record =
          edits && Object.prototype.hasOwnProperty.call(edits, plan.ref)
            ? edits[plan.ref]
            : plan.record;
        await adapter.commit(record);
        results.push({ ref: plan.ref, action: plan.action, ok: true });
      } catch (e) {
        results.push({
          ref: plan.ref,
          action: plan.action,
          ok: false,
          error: errorMessage(e),
        });
      }
    }
    this.staged.delete(planId);

    const created = results.filter((r) => r.ok && r.action === 'create').length;
    const updated = results.filter((r) => r.ok && r.action === 'update').length;
    const failed = results.filter((r) => !r.ok).length;
    return { created, updated, failed, results };
  }

  /** Drop staged plans past their TTL so the map can't grow unbounded. */
  private gc() {
    const cutoff = Date.now() - PLAN_TTL_MS;
    for (const [id, plan] of this.staged) {
      if (plan.createdAt < cutoff) this.staged.delete(id);
    }
  }
}
