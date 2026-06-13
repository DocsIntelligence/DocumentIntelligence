import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiUsagePurgeService } from './ai-usage.purge';
import { AiUsageService, type ListUsageQuery } from './ai-usage.service';

/**
 * Read-side endpoints for the AI usage ledger.
 *
 *  GET /me/ai-usage                           — current user's calls
 *  GET /me/ai-usage/summary                   — current user's totals + chart
 *  GET /admin/ai-usage                        — every call (paginated, filterable)
 *  GET /admin/ai-usage/summary                — workspace-wide totals + chart
 *  GET /admin/ai-usage/by-document/:id        — rollup for a drafting document
 *  GET /admin/ai-usage/by-source/:id          — rollup for an uploaded source
 *  GET /admin/ai-usage/by-pipeline-run/:id    — rollup for one pipeline run
 *  GET /admin/ai-usage/by-user/:id            — rollup for one user
 *  GET /admin/ai-usage/by-org/:id             — rollup for one org
 */
@Controller()
export class AiUsageController {
  constructor(
    private readonly usage: AiUsageService,
    private readonly purge: AiUsagePurgeService,
  ) {}

  // ── Self-service ───────────────────────────────────────────────────────
  @Get('me/ai-usage')
  myCalls(@CurrentUser() user: User, @Query() query: ListUsageQuery) {
    return this.usage.list({ ...query, userId: user.id });
  }

  @Get('me/ai-usage/summary')
  mySummary(@CurrentUser() user: User, @Query() query: ListUsageQuery) {
    return this.usage.summary({ ...query, userId: user.id });
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  @Get('admin/ai-usage')
  list(@Query() query: ListUsageQuery) {
    return this.usage.list(query);
  }

  @Get('admin/ai-usage/summary')
  summary(@Query() query: ListUsageQuery) {
    return this.usage.summary(query);
  }

  @Get('admin/ai-usage/by-document/:id')
  byDocument(@Param('id') id: string, @Query() query: ListUsageQuery) {
    return this.usage.summary({ ...query, documentId: id });
  }

  @Get('admin/ai-usage/by-source/:id')
  bySource(@Param('id') id: string, @Query() query: ListUsageQuery) {
    return this.usage.summary({ ...query, sourceDocumentId: id });
  }

  @Get('admin/ai-usage/by-pipeline-run/:id')
  byPipelineRun(@Param('id') id: string, @Query() query: ListUsageQuery) {
    return this.usage.summary({ ...query, pipelineRunId: id });
  }

  @Get('admin/ai-usage/by-batch/:id')
  byBatch(@Param('id') id: string, @Query() query: ListUsageQuery) {
    return this.usage.summary({ ...query, batchId: id });
  }

  @Get('admin/ai-usage/by-user/:id')
  byUser(@Param('id') id: string, @Query() query: ListUsageQuery) {
    return this.usage.summary({ ...query, userId: id });
  }

  @Get('admin/ai-usage/by-org/:id')
  byOrg(@Param('id') id: string, @Query() query: ListUsageQuery) {
    return this.usage.summary({ ...query, orgId: id });
  }

  /**
   * Manual trigger for the retention purge — useful right after lowering the
   * retention setting (the scheduler runs only every 6 h). Returns the row
   * count that was deleted.
   */
  @Post('admin/ai-usage/purge')
  async runPurge() {
    const deleted = await this.purge.purge();
    return { deleted };
  }
}
