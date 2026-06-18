import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  buildAnalysisPrompt,
  buildAnalysisSchema,
  buildAskPrompt,
  chunkPages,
  topKChunks,
  type AnalysisData,
  type EmbeddedChunk,
} from '@org/doc-intelligence';
import { validateCitations } from '@org/legal-reference';
import { createHash } from 'node:crypto';
import { AiService } from '../../ai/ai.service';
import { DatabaseService } from '../../database/database.service';
import { AssetDocumentService } from './asset-document.service';

/**
 * Analysis + RAG "ask this document" for estate/wealth documents (statements,
 * policies, deeds). Mirrors the docs-module behaviour — same prompts, schema,
 * citation validation, chunked embeddings — and writes to the SAME polymorphic
 * tables (`AnalysisRun`, `SourceChunk`) under `subjectType = 'asset_document'`,
 * so the original document and its analysis live together exactly like docs.
 *
 * Kept self-contained (rather than importing the docs `AnalysisService`) to
 * avoid coupling the estate module to the documents/search/wallet graph.
 */
const SUBJECT = 'asset_document';

@Injectable()
export class EstateDocumentAnalysisService {
  private readonly logger = new Logger(EstateDocumentAnalysisService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly docs: AssetDocumentService,
  ) {}

  /** Analyze an attached document; cached by content hash unless `force`. */
  async analyze(
    userId: string,
    assetId: string,
    docId: string,
    opts?: { force?: boolean },
  ) {
    const { text } = await this.docs.normalizedTextForDoc(userId, assetId, docId);
    if (!text) {
      throw new BadRequestException(
        'Nothing to analyse — this document has no extractable text yet.',
      );
    }
    // Cache the parsed text on the document so it's findable in vault search
    // without re-parsing the file on every query.
    await this.db.assetDocument
      .update({ where: { id: docId }, data: { searchText: text } })
      .catch(() => undefined);

    const contentHash = createHash('sha256').update(text).digest('hex');
    if (!opts?.force) {
      const cached = await this.db.analysisRun.findFirst({
        where: { subjectType: SUBJECT, subjectId: docId, contentHash },
        orderBy: { createdAt: 'desc' },
      });
      if (cached) return cached;
    }

    const { system, instruction } = buildAnalysisPrompt();
    const { data } = await this.ai.extract<AnalysisData>(
      [{ kind: 'text', text: `${instruction}\n\nDocument:\n${text}` }],
      buildAnalysisSchema(),
      { systemPrompt: system, schemaName: 'record_analysis', instruction },
    );

    // Citations are verified deterministically, never asserted by the model.
    const citationFindings = validateCitations(text);

    const run = await this.db.analysisRun.create({
      data: {
        subjectType: SUBJECT,
        subjectId: docId,
        sourceDocumentId: null,
        contentHash,
        summary: data.summary ?? null,
        parties: (data.parties ?? []) as unknown as Prisma.InputJsonValue,
        keyDates: (data.keyDates ?? []) as unknown as Prisma.InputJsonValue,
        obligations: (data.obligations ?? []) as unknown as Prisma.InputJsonValue,
        riskFlags: (data.riskFlags ?? []) as unknown as Prisma.InputJsonValue,
        citationFindings: citationFindings as unknown as Prisma.InputJsonValue,
      },
    });
    this.logger.log(
      `Analyzed asset_document ${docId}: ${data.parties?.length ?? 0} parties, ${citationFindings.length} citation flag(s)`,
    );
    return run;
  }

  /** Latest cached analysis for a document (access-checked). */
  async latest(userId: string, assetId: string, docId: string) {
    await this.docs.assertDocAccess(userId, assetId, docId);
    const analysis = await this.db.analysisRun.findFirst({
      where: { subjectType: SUBJECT, subjectId: docId },
      orderBy: { createdAt: 'desc' },
    });
    return { analysis };
  }

  /** Grounded Q&A over the document via chunk-embedding retrieval. */
  async ask(
    userId: string,
    assetId: string,
    docId: string,
    question: string,
  ) {
    const q = question?.trim();
    if (!q) throw new BadRequestException('Ask a question.');
    const { normalized } = await this.docs.normalizedTextForDoc(
      userId,
      assetId,
      docId,
    );
    if (!normalized) {
      throw new BadRequestException(
        'This document has no text layer yet — Q&A needs extractable text.',
      );
    }
    const chunks = await this.ensureChunks(docId, normalized);
    if (chunks.length === 0) {
      throw new BadRequestException('No content to search in this document.');
    }
    const [queryEmbedding] = await this.ai.embed([q]);
    const retrieved = topKChunks(queryEmbedding, chunks, 5);
    const { system, user } = buildAskPrompt(q, retrieved);
    const res = await this.ai.generate(user, { systemPrompt: system });
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
    docId: string,
    normalized: Parameters<typeof chunkPages>[0],
  ): Promise<EmbeddedChunk[]> {
    const existing = await this.db.sourceChunk.findMany({
      where: { subjectType: SUBJECT, subjectId: docId },
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
        subjectType: SUBJECT,
        subjectId: docId,
        sourceDocumentId: null,
        page: c.page,
        ordinal: c.ordinal,
        text: c.text,
        embedding: c.embedding,
      })),
    });
    return embedded;
  }
}
