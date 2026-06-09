/**
 * Phase 2 RAG (docs/05 §7) — pure helpers for "ask this document" with
 * page-cited answers. Chunk normalized per-page text, embed (in the API),
 * retrieve by cosine similarity (single-document → in-process, no pgvector),
 * and build a grounded, page-citing prompt. The model answers ONLY from the
 * retrieved chunks and cites the page numbers it used.
 */

import type { NormalizedDocument } from './types';

export interface TextChunk {
  page: number;
  ordinal: number;
  text: string;
}

export interface EmbeddedChunk extends TextChunk {
  embedding: number[];
}

export interface RetrievedChunk extends TextChunk {
  score: number;
}

/**
 * Split each page's text into ~`maxChars` chunks on whitespace boundaries.
 * Keeps the page number so retrieved chunks can cite their page.
 */
export function chunkPages(
  doc: NormalizedDocument,
  maxChars = 1200,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (const page of doc.pages) {
    const text = (page.text ?? '').trim();
    if (!text) continue;
    const words = text.split(/\s+/);
    let buf = '';
    let ordinal = 0;
    for (const word of words) {
      if (buf.length + word.length + 1 > maxChars && buf) {
        chunks.push({ page: page.page, ordinal: ordinal++, text: buf.trim() });
        buf = '';
      }
      buf += (buf ? ' ' : '') + word;
    }
    if (buf.trim()) {
      chunks.push({ page: page.page, ordinal: ordinal++, text: buf.trim() });
    }
  }
  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Top-k chunks by cosine similarity to the query embedding. */
export function topKChunks(
  queryEmbedding: number[],
  chunks: EmbeddedChunk[],
  k = 5,
): RetrievedChunk[] {
  return chunks
    .map((c) => ({
      page: c.page,
      ordinal: c.ordinal,
      text: c.text,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const ASK_SYSTEM = [
  'You answer questions about a single legal document using ONLY the provided excerpts.',
  'Rules:',
  '- Use only the excerpts; if the answer is not in them, say you could not find it in the document.',
  '- Cite the page number(s) you used, in the form (p. N), inline.',
  '- Do not assert statute/section numbers unless they appear verbatim in an excerpt.',
].join('\n');

/** Build the grounded Q&A prompt from retrieved, page-tagged excerpts. */
export function buildAskPrompt(
  question: string,
  retrieved: RetrievedChunk[],
): { system: string; user: string } {
  const context = retrieved
    .map((c) => `[Page ${c.page}] ${c.text}`)
    .join('\n\n');
  return {
    system: ASK_SYSTEM,
    user: `Document excerpts:\n${context}\n\nQuestion: ${question}\n\nAnswer (cite pages as (p. N)):`,
  };
}
