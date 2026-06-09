import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Feature, Prisma } from '@prisma/client';
import {
  buildAnalysisPrompt,
  buildAnalysisSchema,
  buildAskPrompt,
  chunkPages,
  topKChunks,
  type AnalysisData,
  type EmbeddedChunk,
  type NormalizedDocument,
} from '@org/doc-intelligence';
import { validateCitations } from '@org/legal-reference';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import { AiService } from '../ai/ai.service';
import { ParsingService } from './parsing.service';
import { sourcePart } from './engines/vlm-extraction.engine';

const MAX_ANALYSIS_CHARS = 60_000;

/**
 * Phase 2 (docs/05 §7): analysis + cited-law health + RAG "ask this document".
 * Self-contained — re-derives (and caches) the normalized text via
 * ParsingService so it doesn't couple to the extraction pipeline.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly parsing: ParsingService,
    private readonly walletUsage: WalletUsageService,
  ) {}

  // ─── Analysis + citation health ─────────────────────────────────────────

  async analyze(userId: string, sourceId: string) {
    const source = await this.loadSource(userId, sourceId);
    const normalized = await this.getNormalized(source);
    const text = normalized ? this.flatten(normalized) : null;

    const { system, instruction } = buildAnalysisPrompt();
    const schema = buildAnalysisSchema();

    // Prefer text (cheap, default provider); fall back to vision over bytes for
    // scanned docs with no text layer.
    const input = text
      ? [{ kind: 'text' as const, text: `${instruction}\n\nDocument:\n${text}` }]
      : [
          { kind: 'text' as const, text: instruction },
          sourcePart(source.contentType, await this.base64(source.s3Key)),
        ];

    const { data } = await this.ai.extract<AnalysisData>(input, schema, {
      systemPrompt: system,
      schemaName: 'record_analysis',
      instruction,
    });

    // Cited-law health is DETERMINISTIC — verify against @org/legal-reference,
    // never trust the model to assert citations (golden rule).
    const citationFindings = text ? validateCitations(text) : [];

    const run = await this.db.analysisRun.create({
      data: {
        sourceDocumentId: sourceId,
        summary: data.summary ?? null,
        parties: (data.parties ?? []) as unknown as Prisma.InputJsonValue,
        keyDates: (data.keyDates ?? []) as unknown as Prisma.InputJsonValue,
        obligations: (data.obligations ?? []) as unknown as Prisma.InputJsonValue,
        riskFlags: (data.riskFlags ?? []) as unknown as Prisma.InputJsonValue,
        citationFindings: citationFindings as unknown as Prisma.InputJsonValue,
      },
    });

    if (source.ownerUserId) {
      await this.walletUsage.trackUsage(source.ownerUserId, Feature.ai_attempts, 1);
    }
    this.logger.log(
      `Analyzed source ${sourceId}: ${data.parties?.length ?? 0} parties, ${citationFindings.length} citation flag(s)`,
    );
    return run;
  }

  async getLatestAnalysis(userId: string, sourceId: string) {
    await this.loadSource(userId, sourceId);
    const run = await this.db.analysisRun.findFirst({
      where: { sourceDocumentId: sourceId },
      orderBy: { createdAt: 'desc' },
    });
    return { sourceDocumentId: sourceId, analysis: run };
  }

  // ─── RAG: ask this document ──────────────────────────────────────────────

  async ask(userId: string, sourceId: string, question: string) {
    const source = await this.loadSource(userId, sourceId);
    const normalized = await this.getNormalized(source);
    if (!normalized || !this.flatten(normalized)) {
      throw new BadRequestException(
        'This document has no text layer yet — Q&A needs extractable text.',
      );
    }

    const chunks = await this.ensureChunks(sourceId, normalized);
    if (chunks.length === 0) {
      throw new BadRequestException('No content to search in this document.');
    }

    const [queryEmbedding] = await this.ai.embed([question]);
    const retrieved = topKChunks(queryEmbedding, chunks, 5);
    const { system, user } = buildAskPrompt(question, retrieved);
    const res = await this.ai.generate(user, { systemPrompt: system });

    if (source.ownerUserId) {
      await this.walletUsage.trackUsage(source.ownerUserId, Feature.ai_attempts, 1);
    }

    return {
      answer: res.text,
      citations: retrieved.map((c) => ({
        page: c.page,
        snippet: c.text.slice(0, 240),
        score: Number(c.score.toFixed(3)),
      })),
    };
  }

  /** Build + persist chunk embeddings once per document; reuse thereafter. */
  private async ensureChunks(
    sourceId: string,
    normalized: NormalizedDocument,
  ): Promise<EmbeddedChunk[]> {
    const existing = await this.db.sourceChunk.findMany({
      where: { sourceDocumentId: sourceId },
    });
    if (existing.length > 0) {
      return existing.map((c) => ({
        page: c.page,
        ordinal: c.ordinal,
        text: c.text,
        embedding: c.embedding,
      }));
    }

    const chunks = chunkPages(normalized);
    if (chunks.length === 0) return [];
    const embeddings = await this.ai.embed(chunks.map((c) => c.text));
    const embedded: EmbeddedChunk[] = chunks.map((c, i) => ({
      ...c,
      embedding: embeddings[i] ?? [],
    }));
    await this.db.sourceChunk.createMany({
      data: embedded.map((c) => ({
        sourceDocumentId: sourceId,
        page: c.page,
        ordinal: c.ordinal,
        text: c.text,
        embedding: c.embedding,
      })),
    });
    return embedded;
  }

  // ─── Shared helpers ───────────────────────────────────────────────────────

  /** Normalized text from cache, else parse the bytes and cache it. */
  private async getNormalized(source: {
    id: string;
    s3Key: string;
    contentType: string;
    language: string | null;
    normalizedText: Prisma.JsonValue;
  }): Promise<NormalizedDocument | null> {
    if (source.normalizedText) {
      return source.normalizedText as unknown as NormalizedDocument;
    }
    if (!this.parsing.canParse(source.contentType)) return null;
    const data = await this.base64(source.s3Key);
    const parsed = await this.parsing.parse({
      data,
      contentType: source.contentType,
      language: source.language ?? undefined,
    });
    if (parsed) {
      await this.db.sourceDocument.update({
        where: { id: source.id },
        data: { normalizedText: parsed as unknown as Prisma.InputJsonValue },
      });
    }
    return parsed;
  }

  private flatten(doc: NormalizedDocument): string {
    return doc.pages
      .map((p) => p.text)
      .join('\n\n')
      .slice(0, MAX_ANALYSIS_CHARS);
  }

  private async base64(key: string): Promise<string> {
    const bytes = this.storage.isLocalBackend()
      ? await this.storage.readBuffer(key)
      : await fetch(await this.storage.getPresignedDownloadUrl(key)).then(
          async (r) => Buffer.from(await r.arrayBuffer()),
        );
    return bytes.toString('base64');
  }

  private async loadSource(userId: string, sourceId: string) {
    const source = await this.db.sourceDocument.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Source document not found');
    if (source.ownerUserId === userId) return source;
    if (source.ownerOrgId) {
      const m = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: source.ownerOrgId, userId } },
      });
      if (m) return source;
    }
    throw new ForbiddenException('Not allowed');
  }
}
