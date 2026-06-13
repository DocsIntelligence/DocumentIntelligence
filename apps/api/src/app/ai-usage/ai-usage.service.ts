import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

export interface ListUsageQuery {
  /** Caller scope. */
  userId?: string;
  orgId?: string;
  documentId?: string;
  sourceDocumentId?: string;
  pipelineRunId?: string;
  extractionId?: string;
  analysisRunId?: string;
  batchId?: string;
  operation?: string;
  provider?: string;
  model?: string;
  status?: string;
  /** ISO date strings. */
  from?: string;
  to?: string;
  /** Free-text search across model + featureCode + tags. */
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | 'durationMs' | 'totalTokens' | 'estimatedCostUsd';
  dir?: 'asc' | 'desc';
}

export interface UsageSummary {
  /** Workspace-wide rollup across the filter window. */
  totals: {
    calls: number;
    successCalls: number;
    errorCalls: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    costUsd: number;
    averageDurationMs: number;
  };
  /** Per-day series for the chart (ordered ascending). */
  daily: Array<{
    day: string; // ISO date
    calls: number;
    tokens: number;
    costUsd: number;
    errors: number;
  }>;
  perOperation: Array<{
    operation: string;
    calls: number;
    tokens: number;
    costUsd: number;
  }>;
  perModel: Array<{
    provider: string;
    model: string;
    calls: number;
    tokens: number;
    costUsd: number;
  }>;
  perProvider: Array<{
    provider: string;
    calls: number;
    tokens: number;
    costUsd: number;
  }>;
  /** P50/P95/P99 wall-clock latency, in ms. */
  latency: { p50: number; p95: number; p99: number };
}

@Injectable()
export class AiUsageService {
  constructor(private readonly db: DatabaseService) {}

  // ── List ───────────────────────────────────────────────────────────────
  async list(q: ListUsageQuery = {}) {
    const where = this.buildWhere(q);
    const page = Math.max(0, q.page ?? 0);
    const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 50));
    const orderBy: Prisma.AiUsageOrderByWithRelationInput = {
      [q.sort ?? 'createdAt']: q.dir ?? 'desc',
    };
    const [rows, total] = await this.db.$transaction([
      this.db.aiUsage.findMany({
        where,
        orderBy,
        skip: page * pageSize,
        take: pageSize,
      }),
      this.db.aiUsage.count({ where }),
    ]);
    return { items: rows.map(this.serialise), total, page, pageSize };
  }

  // ── Summary ────────────────────────────────────────────────────────────
  async summary(q: ListUsageQuery = {}): Promise<UsageSummary> {
    const where = this.buildWhere(q);
    const rangeFrom = q.from ? new Date(q.from) : this.daysAgo(30);
    const rangeTo = q.to ? new Date(q.to) : new Date();

    // ── totals ────────────────────────────────────────────────────────
    const agg = await this.db.aiUsage.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cachedInputTokens: true,
        cacheWriteTokens: true,
        reasoningTokens: true,
        totalTokens: true,
        estimatedCostUsd: true,
      },
      _avg: { durationMs: true },
    });
    const errorCalls = await this.db.aiUsage.count({
      where: { ...where, status: { not: 'success' } },
    });
    const successCalls = (agg._count._all ?? 0) - errorCalls;

    // ── per-day series ────────────────────────────────────────────────
    const dailyRows = await this.db.$queryRaw<
      Array<{ day: Date; calls: bigint; tokens: bigint; cost: number; errors: bigint }>
    >`
      SELECT date_trunc('day', "createdAt")::date AS day,
             COUNT(*)::bigint AS calls,
             COALESCE(SUM("totalTokens"), 0)::bigint AS tokens,
             COALESCE(SUM("estimatedCostUsd"), 0)::float AS cost,
             COUNT(*) FILTER (WHERE status <> 'success')::bigint AS errors
        FROM "AiUsage"
       WHERE "createdAt" BETWEEN ${rangeFrom} AND ${rangeTo}
         ${this.scopeRaw(q)}
       GROUP BY day
       ORDER BY day ASC
    `;

    // ── group-by rollups ──────────────────────────────────────────────
    const perOp = await this.db.aiUsage.groupBy({
      by: ['operation'],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true },
      orderBy: { _sum: { estimatedCostUsd: 'desc' } },
    });
    const perModel = await this.db.aiUsage.groupBy({
      by: ['provider', 'model'],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true },
      orderBy: { _sum: { estimatedCostUsd: 'desc' } },
    });
    const perProvider = await this.db.aiUsage.groupBy({
      by: ['provider'],
      where,
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true },
      orderBy: { _sum: { estimatedCostUsd: 'desc' } },
    });

    // ── p50/p95/p99 latency ───────────────────────────────────────────
    const latRows = await this.db.$queryRaw<
      Array<{ p50: number; p95: number; p99: number }>
    >`
      SELECT
        percentile_cont(0.50) WITHIN GROUP (ORDER BY "durationMs")::float AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::float AS p95,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY "durationMs")::float AS p99
      FROM "AiUsage"
      WHERE "createdAt" BETWEEN ${rangeFrom} AND ${rangeTo}
        ${this.scopeRaw(q)}
    `;
    const lat = latRows[0] ?? { p50: 0, p95: 0, p99: 0 };

    return {
      totals: {
        calls: agg._count._all ?? 0,
        successCalls,
        errorCalls,
        inputTokens: agg._sum.inputTokens ?? 0,
        outputTokens: agg._sum.outputTokens ?? 0,
        cachedInputTokens: agg._sum.cachedInputTokens ?? 0,
        cacheWriteTokens: agg._sum.cacheWriteTokens ?? 0,
        reasoningTokens: agg._sum.reasoningTokens ?? 0,
        totalTokens: agg._sum.totalTokens ?? 0,
        costUsd: Number(agg._sum.estimatedCostUsd ?? 0),
        averageDurationMs: Math.round(agg._avg.durationMs ?? 0),
      },
      daily: dailyRows.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        calls: Number(r.calls),
        tokens: Number(r.tokens),
        costUsd: Number(r.cost),
        errors: Number(r.errors),
      })),
      perOperation: perOp.map((r) => ({
        operation: r.operation,
        calls: r._count._all,
        tokens: r._sum.totalTokens ?? 0,
        costUsd: Number(r._sum.estimatedCostUsd ?? 0),
      })),
      perModel: perModel.map((r) => ({
        provider: r.provider,
        model: r.model,
        calls: r._count._all,
        tokens: r._sum.totalTokens ?? 0,
        costUsd: Number(r._sum.estimatedCostUsd ?? 0),
      })),
      perProvider: perProvider.map((r) => ({
        provider: r.provider,
        calls: r._count._all,
        tokens: r._sum.totalTokens ?? 0,
        costUsd: Number(r._sum.estimatedCostUsd ?? 0),
      })),
      latency: {
        p50: Math.round(lat.p50 ?? 0),
        p95: Math.round(lat.p95 ?? 0),
        p99: Math.round(lat.p99 ?? 0),
      },
    };
  }

  // ── Where-clause builder ───────────────────────────────────────────────
  private buildWhere(q: ListUsageQuery): Prisma.AiUsageWhereInput {
    const where: Prisma.AiUsageWhereInput = {};
    if (q.userId) where.userId = q.userId;
    if (q.orgId) where.orgId = q.orgId;
    if (q.documentId) where.documentId = q.documentId;
    if (q.sourceDocumentId) where.sourceDocumentId = q.sourceDocumentId;
    if (q.pipelineRunId) where.pipelineRunId = q.pipelineRunId;
    if (q.extractionId) where.extractionId = q.extractionId;
    if (q.analysisRunId) where.analysisRunId = q.analysisRunId;
    if (q.batchId) where.batchId = q.batchId;
    if (q.operation) where.operation = q.operation;
    if (q.provider) where.provider = q.provider;
    if (q.model) where.model = q.model;
    if (q.status) where.status = q.status;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to);
    }
    if (q.q) {
      where.OR = [
        { model: { contains: q.q, mode: 'insensitive' } },
        { featureCode: { contains: q.q, mode: 'insensitive' } },
        { errorMessage: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  /** Hand-written WHERE for raw SQL paths (daily series + percentiles). */
  private scopeRaw(q: ListUsageQuery): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (q.userId) parts.push(Prisma.sql`AND "userId" = ${q.userId}`);
    if (q.orgId) parts.push(Prisma.sql`AND "orgId" = ${q.orgId}`);
    if (q.documentId) parts.push(Prisma.sql`AND "documentId" = ${q.documentId}`);
    if (q.sourceDocumentId)
      parts.push(Prisma.sql`AND "sourceDocumentId" = ${q.sourceDocumentId}`);
    if (q.pipelineRunId)
      parts.push(Prisma.sql`AND "pipelineRunId" = ${q.pipelineRunId}`);
    if (q.batchId) parts.push(Prisma.sql`AND "batchId" = ${q.batchId}`);
    if (q.operation) parts.push(Prisma.sql`AND "operation" = ${q.operation}`);
    if (q.provider) parts.push(Prisma.sql`AND "provider" = ${q.provider}`);
    if (q.model) parts.push(Prisma.sql`AND "model" = ${q.model}`);
    return parts.length
      ? Prisma.join(parts, ' ')
      : Prisma.empty;
  }

  private serialise = (r: Prisma.AiUsageGetPayload<NonNullable<unknown>>) => ({
    ...r,
    estimatedCostUsd: Number(r.estimatedCostUsd),
  });

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  }
}
