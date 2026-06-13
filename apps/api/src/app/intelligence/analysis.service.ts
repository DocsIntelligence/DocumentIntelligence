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
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { DocumentsService } from '../documents/documents.service';
import { StorageService } from '../storage/storage.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import { AiService } from '../ai/ai.service';
import { SearchIndexService } from '../search/search-index.service';
import { SearchTextService } from '../search/search-text.service';
import { ParsingService } from './parsing.service';
import { sourcePart } from './engines/vlm-extraction.engine';

const MAX_ANALYSIS_CHARS = 60_000;

type SubjectType = 'source' | 'document';

/** A subject resolved to the text/bytes we can analyse + ask over. */
interface ResolvedSubject {
  subjectType: SubjectType;
  subjectId: string;
  ownerUserId: string | null;
  /** Parsed/derived text, or null for a scanned source with no text layer. */
  text: string | null;
  normalized: NormalizedDocument | null;
  /** Source-only: lets the analysis fall back to vision over the raw bytes. */
  source?: {
    contentType: string;
    s3Key: string;
  };
}

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
    private readonly searchIndex: SearchIndexService,
    private readonly searchText: SearchTextService,
    private readonly documents: DocumentsService,
  ) {}

  // ─── Public API: sources (back-compat) ────────────────────────────────────

  analyze(userId: string, sourceId: string) {
    return this.analyzeSubject(userId, 'source', sourceId);
  }

  getLatestAnalysis(userId: string, sourceId: string) {
    return this.getLatestForSubject(userId, 'source', sourceId);
  }

  ask(userId: string, sourceId: string, question: string) {
    return this.askSubject(userId, 'source', sourceId, question);
  }

  // ─── Public API: drafting documents (docs/09 #6) ──────────────────────────

  analyzeDocument(userId: string, documentId: string) {
    return this.analyzeSubject(userId, 'document', documentId);
  }

  getLatestDocumentAnalysis(userId: string, documentId: string) {
    return this.getLatestForSubject(userId, 'document', documentId);
  }

  askDocument(userId: string, documentId: string, question: string) {
    return this.askSubject(userId, 'document', documentId, question);
  }

  // ─── Subject-polymorphic core ─────────────────────────────────────────────

  private async analyzeSubject(
    userId: string,
    subjectType: SubjectType,
    subjectId: string,
  ) {
    const subject = await this.resolveSubject(userId, subjectType, subjectId);
    const { text } = subject;

    // Cache: reuse an existing run if the analyzed text is unchanged (dedup by
    // content hash). Only when we actually have text to hash.
    const contentHash = text ? this.hash(text) : null;
    if (contentHash) {
      const cached = await this.db.analysisRun.findFirst({
        where: { subjectType, subjectId, contentHash },
        orderBy: { createdAt: 'desc' },
      });
      if (cached) return cached;
    }

    const { system, instruction } = buildAnalysisPrompt();
    const schema = buildAnalysisSchema();

    // Prefer text (cheap); fall back to vision over bytes for scanned sources.
    const input = text
      ? [{ kind: 'text' as const, text: `${instruction}\n\nDocument:\n${text}` }]
      : subject.source
        ? [
            { kind: 'text' as const, text: instruction },
            sourcePart(
              subject.source.contentType,
              await this.base64(subject.source.s3Key),
            ),
          ]
        : null;
    if (!input) {
      throw new BadRequestException(
        'Nothing to analyse — this document has no extractable text yet.',
      );
    }

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
        subjectType,
        subjectId,
        sourceDocumentId: subjectType === 'source' ? subjectId : null,
        contentHash,
        summary: data.summary ?? null,
        parties: (data.parties ?? []) as unknown as Prisma.InputJsonValue,
        keyDates: (data.keyDates ?? []) as unknown as Prisma.InputJsonValue,
        obligations: (data.obligations ?? []) as unknown as Prisma.InputJsonValue,
        riskFlags: (data.riskFlags ?? []) as unknown as Prisma.InputJsonValue,
        citationFindings: citationFindings as unknown as Prisma.InputJsonValue,
      },
    });

    if (subject.ownerUserId) {
      await this.walletUsage.trackUsage(subject.ownerUserId, Feature.ai_attempts, 1);
    }
    this.logger.log(
      `Analyzed ${subjectType} ${subjectId}: ${data.parties?.length ?? 0} parties, ${citationFindings.length} citation flag(s)`,
    );
    if (subjectType === 'source') this.searchIndex.enqueueSource(subjectId);
    return run;
  }

  private async getLatestForSubject(
    userId: string,
    subjectType: SubjectType,
    subjectId: string,
  ) {
    await this.assertSubjectAccess(userId, subjectType, subjectId);
    const run = await this.db.analysisRun.findFirst({
      where: { subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
    });
    return { subjectType, subjectId, sourceDocumentId: subjectId, analysis: run };
  }

  // ─── RAG: ask any subject ──────────────────────────────────────────────────

  private async askSubject(
    userId: string,
    subjectType: SubjectType,
    subjectId: string,
    question: string,
  ) {
    const subject = await this.resolveSubject(userId, subjectType, subjectId);
    if (!subject.normalized || !this.flatten(subject.normalized)) {
      throw new BadRequestException(
        'This document has no text layer yet — Q&A needs extractable text.',
      );
    }

    const chunks = await this.ensureChunks(subjectType, subjectId, subject.normalized);
    if (chunks.length === 0) {
      throw new BadRequestException('No content to search in this document.');
    }

    const [queryEmbedding] = await this.ai.embed([question]);
    const retrieved = topKChunks(queryEmbedding, chunks, 5);
    const { system, user } = buildAskPrompt(question, retrieved);
    const res = await this.ai.generate(user, { systemPrompt: system });

    if (subject.ownerUserId) {
      await this.walletUsage.trackUsage(subject.ownerUserId, Feature.ai_attempts, 1);
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

  /** Build + persist chunk embeddings once per subject; reuse thereafter. */
  private async ensureChunks(
    subjectType: SubjectType,
    subjectId: string,
    normalized: NormalizedDocument,
  ): Promise<EmbeddedChunk[]> {
    const existing = await this.db.sourceChunk.findMany({
      where: { subjectType, subjectId },
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
        subjectType,
        subjectId,
        sourceDocumentId: subjectType === 'source' ? subjectId : null,
        page: c.page,
        ordinal: c.ordinal,
        text: c.text,
        embedding: c.embedding,
      })),
    });
    return embedded;
  }

  // ─── Subject resolution ─────────────────────────────────────────────────────

  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  /** Load + access-check a subject and derive its analysable text. */
  private async resolveSubject(
    userId: string,
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<ResolvedSubject> {
    if (subjectType === 'source') {
      const source = await this.loadSource(userId, subjectId);
      const normalized = await this.getNormalized(source);
      return {
        subjectType,
        subjectId,
        ownerUserId: source.ownerUserId,
        text: normalized ? this.flatten(normalized) : null,
        normalized,
        source: { contentType: source.contentType, s3Key: source.s3Key },
      };
    }
    // 'document' — getById enforces access (throws if not allowed).
    const doc = await this.documents.getById(userId, subjectId);
    const extracted = await this.searchText.forDocument(subjectId);
    const text = extracted?.bodyText?.trim() ? extracted.bodyText : null;
    const normalized: NormalizedDocument | null = text
      ? { pages: [{ page: 1, text }] }
      : null;
    return {
      subjectType,
      subjectId,
      ownerUserId: (doc as { ownerUserId: string | null }).ownerUserId ?? null,
      text,
      normalized,
    };
  }

  private async assertSubjectAccess(
    userId: string,
    subjectType: SubjectType,
    subjectId: string,
  ): Promise<void> {
    if (subjectType === 'source') {
      await this.loadSource(userId, subjectId);
    } else {
      await this.documents.getById(userId, subjectId);
    }
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
