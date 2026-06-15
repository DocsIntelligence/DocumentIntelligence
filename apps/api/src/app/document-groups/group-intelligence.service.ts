import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AiService } from '../ai/ai.service';
import { SearchService } from '../search/search.service';
import { DocumentGroupsService } from './document-groups.service';

export interface GroupSearchParams {
  q: string;
  sort?: 'relevance' | 'recent' | 'title';
  page?: number;
  pageSize?: number;
}

export interface GroupSummaryResult {
  summary: string;
  documentSummaries: Array<{
    documentId: string;
    title: string;
    summary: string | null;
  }>;
  model: string;
  generatedAt: string;
  unanalyzedCount: number;
}

/**
 * Group-scoped intelligence: search within a group's documents and generate
 * a group-level summary by aggregating individual document analysis summaries.
 */
@Injectable()
export class GroupIntelligenceService {
  private readonly logger = new Logger(GroupIntelligenceService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly search: SearchService,
    private readonly groups: DocumentGroupsService,
  ) {}

  /**
   * Full-text + semantic search scoped to a single group. The filter is pushed
   * into SearchService SQL (EXISTS against Document.groupId), so pagination,
   * total count and facets are correct — no post-filter on a page of results.
   */
  async searchInGroup(
    userId: string,
    groupId: string,
    params: GroupSearchParams,
  ) {
    // Access check (throws Forbidden/NotFound). We don't need the documents.
    await this.groups.getById(userId, groupId);

    return this.search.search(userId, {
      q: params.q,
      sort: params.sort ?? 'relevance',
      page: params.page ?? 0,
      pageSize: params.pageSize ?? 20,
      groupId,
    });
  }

  /**
   * Generate a group-level summary by:
   * 1. Fetching the latest AnalysisRun summary for each document in the group
   * 2. Combining them into a prompt and asking the AI to synthesize a group overview
   *
   * Does NOT generate individual doc summaries — those must already exist
   * from prior analysis runs. If no doc summaries exist, returns a message
   * asking the user to analyze the documents first.
   */
  async generateGroupSummary(
    userId: string,
    groupId: string,
  ): Promise<GroupSummaryResult> {
    const group = await this.groups.getById(userId, groupId);

    if (group.documents.length === 0) {
      throw new BadRequestException(
        'This group has no documents to summarize.',
      );
    }

    // Fetch the latest analysis run per document in one query. DISTINCT ON
    // collapses each (subjectType, subjectId) to its newest row — keeps us out
    // of the N+1 trap a loop of findFirst() would create.
    const docIds = group.documents.map((d) => d.id);
    const runs = await this.db.$queryRaw<
      Array<{ subjectId: string; summary: string | null }>
    >`
      SELECT DISTINCT ON ("subjectId") "subjectId", summary
      FROM "AnalysisRun"
      WHERE "subjectType" = 'document'
        AND "subjectId" = ANY(${docIds})
      ORDER BY "subjectId", "createdAt" DESC
    `;
    const summaryById = new Map(
      runs.map((r) => [r.subjectId, r.summary ?? null] as const),
    );

    const docSummaries = group.documents.map((d) => ({
      documentId: d.id,
      title: d.title,
      summary: summaryById.get(d.id) ?? null,
    }));

    const withSummaries = docSummaries.filter((d) => d.summary);

    if (withSummaries.length === 0) {
      throw new BadRequestException(
        'None of the documents in this group have been analyzed yet. Run document analysis first, then generate the group summary.',
      );
    }

    // Build the prompt from existing summaries
    const docBlock = withSummaries
      .map((d, i) => `${i + 1}. "${d.title}": ${d.summary}`)
      .join('\n');

    const prompt = `You are summarizing a group of related legal documents titled "${group.name}" (${group.kind}).

The group contains ${group.documents.length} documents. Below are the individual document summaries (from prior analysis):

${docBlock}

${withSummaries.length < group.documents.length ? `Note: ${group.documents.length - withSummaries.length} document(s) have not been analyzed yet and are excluded from this summary.\n` : ''}
Produce a concise group-level summary (3-5 sentences) that:
- Identifies the common theme or purpose of this document set
- Notes the key parties involved across documents
- Highlights any notable dates, amounts, or obligations
- Mentions the document types present

Output ONLY the summary text, no headers or labels.`;

    const response = await this.ai.generate(prompt, {
      temperature: 0.3,
      maxTokens: 500,
    });

    // Persist the summary in group metadata
    const existingMeta = (group.metadata ?? {}) as Record<string, unknown>;
    await this.db.documentGroup.update({
      where: { id: groupId },
      data: {
        metadata: {
          ...existingMeta,
          summary: response.text,
          summaryGeneratedAt: new Date().toISOString(),
          summaryModel: response.model,
        },
      },
    });

    return {
      summary: response.text,
      documentSummaries: docSummaries,
      model: response.model,
      generatedAt: new Date().toISOString(),
      unanalyzedCount: group.documents.length - withSummaries.length,
    };
  }

  /**
   * Read-only accessor for a previously generated group summary. Returns null
   * if nothing has been generated yet so the UI can show a "Generate" CTA
   * without first attempting a generation.
   */
  async getStoredSummary(userId: string, groupId: string) {
    const group = await this.groups.getById(userId, groupId);
    const meta = (group.metadata ?? {}) as Record<string, unknown>;
    const summary = typeof meta.summary === 'string' ? meta.summary : null;
    if (!summary) return null;
    return {
      summary,
      generatedAt:
        typeof meta.summaryGeneratedAt === 'string'
          ? meta.summaryGeneratedAt
          : null,
      model:
        typeof meta.summaryModel === 'string' ? meta.summaryModel : null,
    };
  }
}
