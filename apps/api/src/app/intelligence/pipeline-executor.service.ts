import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ExtractionEngineMode,
  PipelineStageType,
  Prisma,
} from '@prisma/client';
import {
  DEFAULT_ROUTING,
  decideReview,
  genericExtractionSchema,
  getExtractionSchema,
  type ExtractionResult,
  type ExtractionSchema,
  type NormalizedDocument,
  type SourceInput,
} from '@org/doc-intelligence';
import { DatabaseService } from '../database/database.service';
import { errorMessage } from '../common/error.util';
import { IntelligenceService } from './intelligence.service';
import { PipelineService } from './pipeline.service';

/** Per-stage config shape (jsonb). All fields optional. */
interface AutoAdvance {
  minOverall?: number;
  minField?: number;
  requireAllRequired?: boolean;
  onFail?: 'review' | 'reject';
}
interface StageConfig {
  engineMode?: ExtractionEngineMode;
  schemaKey?: string;
  autoAdvance?: AutoAdvance;
  targets?: string[];
}

/** Context threaded between stages within a single run. */
interface RunContext {
  sourceDocumentId: string;
  source: SourceInput;
  parsed: NormalizedDocument | null;
  schema: ExtractionSchema;
  documentTypeKey: string | null;
  extractionId: string | null;
  result: ExtractionResult | null;
  ownerUserId: string | null;
}

export const DEFAULT_PIPELINE_KEY = 'default';

/**
 * Data-driven pipeline executor (docs/07 P4.1). Walks a PipelineRun's stages in
 * order, dispatching each by `type` to the SAME engines the single-doc flow
 * uses (via PipelineService) — one source of truth, no duplication. Each stage
 * is recorded as a StageExecution (audit + heartbeat). A stage either
 * auto-advances when its configured score is cleared, or parks the run for human
 * review. Additive: the legacy IntelligenceJob flow is untouched.
 *
 * P4.1 runs the whole run inline (fire-and-forget); per-stage queueing, batch
 * fan-out, a review queue, and DB-authored pipelines/schemas are later phases.
 */
@Injectable()
export class PipelineExecutorService {
  private readonly logger = new Logger(PipelineExecutorService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly pipeline: PipelineService,
    private readonly intelligence: IntelligenceService,
  ) {}

  /** Create a run for a source on a pipeline (default if unspecified) and start it. */
  async startRun(
    userId: string,
    sourceId: string,
    pipelineKey?: string,
    opts?: { batchId?: string; pipelineId?: string },
  ) {
    const source = await this.db.sourceDocument.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Source document not found');
    if (source.ownerUserId !== userId) {
      if (source.ownerOrgId) {
        const m = await this.db.orgMember.findUnique({
          where: { orgId_userId: { orgId: source.ownerOrgId, userId } },
        });
        if (!m) throw new ForbiddenException('Not allowed');
      } else {
        throw new ForbiddenException('Not allowed');
      }
    }

    const pipelineId =
      opts?.pipelineId ??
      (await this.ensureDefaultPipeline(pipelineKey ?? DEFAULT_PIPELINE_KEY)).id;
    const run = await this.db.pipelineRun.create({
      data: {
        pipelineId,
        batchId: opts?.batchId ?? null,
        sourceDocumentId: sourceId,
        status: 'queued',
      },
    });

    // P4.1: run inline, fire-and-forget. Client polls getRun().
    setImmediate(() => {
      void this.run(run.id).catch((e) =>
        this.logger.error(`Pipeline run ${run.id} failed: ${errorMessage(e)}`),
      );
    });
    return { pipelineRunId: run.id, pipelineId };
  }

  async getRun(userId: string, runId: string) {
    const run = await this.db.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        sourceDocument: true,
        executions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    if (run.sourceDocument.ownerUserId !== userId && run.sourceDocument.ownerOrgId) {
      const m = await this.db.orgMember.findUnique({
        where: {
          orgId_userId: { orgId: run.sourceDocument.ownerOrgId, userId },
        },
      });
      if (!m) throw new ForbiddenException('Not allowed');
    }
    return {
      id: run.id,
      status: run.status,
      currentStageId: run.currentStageId,
      error: run.error,
      sourceDocumentId: run.sourceDocumentId,
      stages: run.executions.map((e) => ({
        stageType: e.stageType,
        status: e.status,
        score: e.score,
        error: e.error,
      })),
    };
  }

  /** Runs parked for human review (the review queue). */
  async reviewQueue(userId: string) {
    const runs = await this.db.pipelineRun.findMany({
      where: {
        status: 'needs_review',
        sourceDocument: { ownerUserId: userId },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        sourceDocument: {
          select: {
            id: true,
            filename: true,
            extractions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, overallConfidence: true, documentTypeKey: true },
            },
          },
        },
      },
    });
    return runs.map((r) => ({
      pipelineRunId: r.id,
      sourceDocumentId: r.sourceDocumentId,
      filename: r.sourceDocument.filename,
      batchId: r.batchId,
      extractionId: r.sourceDocument.extractions[0]?.id ?? null,
      documentTypeKey: r.sourceDocument.extractions[0]?.documentTypeKey ?? null,
      overallConfidence: r.sourceDocument.extractions[0]?.overallConfidence ?? null,
    }));
  }

  /**
   * Approve a parked run: continue the pipeline from the stage AFTER the one it
   * parked at (i.e. run export) using the now human-corrected Extraction. The
   * reviewer's edits were already saved on the Extraction via saveReview.
   */
  async approveRun(userId: string, runId: string) {
    const run = await this.db.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        sourceDocument: {
          include: { extractions: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
        pipeline: { include: { stages: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    if (run.sourceDocument.ownerUserId !== userId) {
      throw new ForbiddenException('Not allowed');
    }
    if (run.status !== 'needs_review') {
      throw new ForbiddenException('Run is not awaiting review');
    }

    const extraction = run.sourceDocument.extractions[0];
    if (!extraction) throw new NotFoundException('No extraction to finalize');

    await this.db.pipelineRun.update({
      where: { id: runId },
      data: { status: 'approved' },
    });

    // Resume: run the stages after the parked one (export) with the corrected
    // extraction. Minimal context — export only needs the extraction id + owner.
    const parkedOrder =
      run.pipeline.stages.find((s) => s.id === run.currentStageId)?.order ?? 0;
    const remaining = run.pipeline.stages.filter((s) => s.order > parkedOrder);
    const ctx: RunContext = {
      sourceDocumentId: run.sourceDocumentId,
      source: { data: '', contentType: run.sourceDocument.contentType },
      parsed: null,
      schema:
        getExtractionSchema(extraction.schemaKey) ?? genericExtractionSchema,
      documentTypeKey: extraction.documentTypeKey,
      extractionId: extraction.id,
      result: null,
      ownerUserId: run.sourceDocument.ownerUserId,
    };

    for (const stage of remaining) {
      const exec = await this.db.stageExecution.create({
        data: {
          pipelineRunId: runId,
          stageId: stage.id,
          stageType: stage.type,
          status: 'running',
          startedAt: new Date(),
          heartbeatAt: new Date(),
        },
      });
      try {
        const { score, output } = await this.runStage(stage, ctx);
        await this.db.stageExecution.update({
          where: { id: exec.id },
          data: {
            status: 'passed',
            score,
            output: (output ?? {}) as Prisma.InputJsonValue,
            finishedAt: new Date(),
          },
        });
      } catch (e) {
        const message = errorMessage(e);
        await this.db.stageExecution.update({
          where: { id: exec.id },
          data: { status: 'failed', error: message, finishedAt: new Date() },
        });
        await this.db.pipelineRun.update({
          where: { id: runId },
          data: { status: 'failed', error: `${stage.type}: ${message}` },
        });
        throw e;
      }
    }

    await this.db.pipelineRun.update({
      where: { id: runId },
      data: { status: 'completed' },
    });
    this.logger.log(`Run ${runId} approved + completed`);
    return { pipelineRunId: runId, status: 'completed' as const };
  }

  // ─── Execution ────────────────────────────────────────────────────────────

  async run(runId: string): Promise<void> {
    const run = await this.db.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        sourceDocument: true,
        pipeline: { include: { stages: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!run || run.status === 'completed') return;

    const src = run.sourceDocument;
    const ctx: RunContext = {
      sourceDocumentId: src.id,
      source: await this.pipeline.buildSourceInput(src),
      parsed: null,
      schema: genericExtractionSchema,
      documentTypeKey: null,
      extractionId: null,
      result: null,
      ownerUserId: src.ownerUserId,
    };

    await this.db.pipelineRun.update({
      where: { id: runId },
      data: { status: 'running' },
    });

    for (const stage of run.pipeline.stages) {
      const exec = await this.db.stageExecution.create({
        data: {
          pipelineRunId: runId,
          stageId: stage.id,
          stageType: stage.type,
          status: 'running',
          startedAt: new Date(),
          heartbeatAt: new Date(),
        },
      });
      await this.db.pipelineRun.update({
        where: { id: runId },
        data: { currentStageId: stage.id },
      });

      try {
        const { score, output, park } = await this.runStage(stage, ctx);
        await this.db.stageExecution.update({
          where: { id: exec.id },
          data: {
            status: park ? 'parked' : 'passed',
            score,
            output: (output ?? {}) as Prisma.InputJsonValue,
            finishedAt: new Date(),
          },
        });

        if (park) {
          await this.db.pipelineRun.update({
            where: { id: runId },
            data: { status: 'needs_review' },
          });
          this.logger.log(`Run ${runId} parked at ${stage.type} for review`);
          return;
        }
      } catch (e) {
        const message = errorMessage(e);
        await this.db.stageExecution.update({
          where: { id: exec.id },
          data: { status: 'failed', error: message, finishedAt: new Date() },
        });
        await this.db.pipelineRun.update({
          where: { id: runId },
          data: { status: 'failed', error: `${stage.type}: ${message}` },
        });
        this.logger.error(`Run ${runId} failed at ${stage.type}: ${message}`);
        return;
      }
    }

    await this.db.pipelineRun.update({
      where: { id: runId },
      data: { status: 'completed' },
    });
    this.logger.log(`Run ${runId} completed`);
  }

  /**
   * Execute one stage. Returns its score, output, and whether to PARK the run
   * (auto-advance condition failed with onFail='review', or a gate stage).
   */
  private async runStage(
    stage: { type: PipelineStageType; config: Prisma.JsonValue },
    ctx: RunContext,
  ): Promise<{ score: number; output: unknown; park: boolean }> {
    const config = (stage.config ?? {}) as StageConfig;

    switch (stage.type) {
      case PipelineStageType.ingest: {
        ctx.parsed = await this.pipeline.parseSource(ctx.source);
        return {
          score: ctx.parsed ? 1 : 0,
          output: { hasTextLayer: Boolean(ctx.parsed) },
          park: false,
        };
      }

      case PipelineStageType.classify: {
        const c = await this.pipeline.classifyDoc(ctx.parsed, ctx.source);
        ctx.documentTypeKey = c.documentTypeKey;
        ctx.schema = c.documentTypeKey
          ? (getExtractionSchema(c.documentTypeKey) ?? genericExtractionSchema)
          : genericExtractionSchema;
        return {
          score: c.confidence,
          output: { documentTypeKey: c.documentTypeKey, confidence: c.confidence },
          park: false,
        };
      }

      case PipelineStageType.extract: {
        const schema = config.schemaKey
          ? (getExtractionSchema(config.schemaKey) ?? ctx.schema)
          : ctx.schema;
        const mode = config.engineMode ?? ExtractionEngineMode.auto;
        const { result } = await this.pipeline.extractOne(
          mode,
          schema,
          ctx.source,
          ctx.parsed,
          ctx.ownerUserId,
        );
        ctx.result = result;
        const created = await this.db.extraction.create({
          data: {
            sourceDocumentId: ctx.sourceDocumentId,
            schemaKey: schema.key,
            documentTypeKey: schema.documentTypeKey ?? null,
            fields: result.fields as unknown as Prisma.InputJsonValue,
            confidence: result.confidence as unknown as Prisma.InputJsonValue,
            overallConfidence: result.overallConfidence,
          },
        });
        ctx.extractionId = created.id;
        return {
          score: result.overallConfidence,
          output: { extractionId: created.id, overallConfidence: result.overallConfidence },
          park: false,
        };
      }

      case PipelineStageType.validate: {
        if (!ctx.result) throw new Error('No extraction to validate');
        const aa = config.autoAdvance ?? {};
        const policy = {
          fieldThreshold: aa.minField ?? DEFAULT_ROUTING.fieldThreshold,
          overallThreshold: aa.minOverall ?? DEFAULT_ROUTING.overallThreshold,
        };
        const review = decideReview(ctx.schema, ctx.result, policy);
        const park = review.needsReview && (aa.onFail ?? 'review') === 'review';
        return {
          score: ctx.result.overallConfidence,
          output: review,
          park,
        };
      }

      case PipelineStageType.review:
        // A pure gate: always park for a human.
        return { score: 0, output: { gate: true }, park: true };

      case PipelineStageType.export: {
        if (!ctx.extractionId) throw new Error('Nothing to export');
        if (!ctx.ownerUserId) {
          // Org-owned export needs a user context — deferred (P4.x).
          return { score: 1, output: { skipped: 'org-owned export deferred' }, park: false };
        }
        const out = await this.intelligence.convert(
          ctx.ownerUserId,
          ctx.extractionId,
        );
        return { score: 1, output: out, park: false };
      }

      default:
        return { score: 1, output: {}, park: false };
    }
  }

  // ─── Default pipeline (seed-on-demand) ─────────────────────────────────────

  /**
   * Ensure a system default pipeline exists (idempotent, like ensureFreeformType).
   * classify → extract → validate(auto-advance ≥0.9) → export. The validate
   * stage parks low-confidence runs for review; high-confidence runs export
   * straight through.
   */
  async ensureDefaultPipeline(key: string) {
    const existing = await this.db.pipeline.findFirst({
      where: { ownerOrgId: null, key, active: true },
      orderBy: { version: 'desc' },
      include: { stages: true },
    });
    if (existing) return existing;

    return this.db.pipeline.create({
      data: {
        ownerOrgId: null,
        key,
        name: 'Default',
        version: 1,
        stages: {
          create: [
            { order: 1, type: PipelineStageType.ingest, name: 'Ingest', config: {} },
            { order: 2, type: PipelineStageType.classify, name: 'Classify', config: {} },
            {
              order: 3,
              type: PipelineStageType.extract,
              name: 'Extract',
              config: { engineMode: 'auto' } as unknown as Prisma.InputJsonValue,
            },
            {
              order: 4,
              type: PipelineStageType.validate,
              name: 'Validate',
              config: {
                autoAdvance: {
                  minOverall: 0.9,
                  minField: 0.85,
                  requireAllRequired: true,
                  onFail: 'review',
                },
              } as unknown as Prisma.InputJsonValue,
            },
            {
              order: 5,
              type: PipelineStageType.export,
              name: 'Export',
              config: { targets: ['structured_document'] } as unknown as Prisma.InputJsonValue,
            },
          ],
        },
      },
      include: { stages: true },
    });
  }
}
