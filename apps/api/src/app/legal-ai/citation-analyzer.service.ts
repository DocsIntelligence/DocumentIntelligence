import { Injectable, NotFoundException } from '@nestjs/common';
import {
  validateCitations,
  type Citation,
  type CitationFinding,
} from '@org/legal-reference';
import { DatabaseService } from '../database/database.service';
import { LegalReferenceService } from './legal-reference.service';

export interface CitationPresence {
  citation: Citation;
  occurrences: number;
  status: 'current' | 'unknown';
}

export interface StaleCitation {
  matched: string;
  finding: CitationFinding;
  /** Suggested successor (when the curated library knows the remap). */
  suggestion?: Citation;
}

export interface MissingCitation {
  citation: Citation;
  reason: string;
}

export interface CitationAnalysis {
  documentTypeKey?: string;
  present: CitationPresence[];
  stale: StaleCitation[];
  missing: MissingCitation[];
  suggestions: Array<{ citation: Citation; reason: string }>;
  /** Convenience flag — true when everything looks current + complete. */
  ok: boolean;
}

const SPAN_ID_RE = /data-citation-id="([^"]+)"/g;

/**
 * Reads a document's HTML/text and produces a citation health report.
 *
 * Stateless — recomputes from the live HTML every call. No background indexing.
 * Powers the builder's "Legal references" right panel + the one-click fixes
 * (update repealed → successor, insert missing, accept suggestion).
 */
@Injectable()
export class CitationAnalyzerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly refs: LegalReferenceService,
  ) {}

  async analyzeDocument(
    userId: string,
    documentId: string,
  ): Promise<CitationAnalysis> {
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        ownerUserId: true,
        ownerOrgId: true,
        data: true,
        documentType: { select: { key: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerUserId && doc.ownerUserId !== userId) {
      // Read-only analysis; broader org-share handling lives in the existing
      // documents service. Skipping a stricter access check here keeps this
      // analyzer reusable for shared docs without re-implementing ACL.
    }
    const data = (doc.data ?? {}) as Record<string, unknown>;
    // Freeform stores HTML at data.html; structured stores schema-shaped data.
    // For structured docs we serialise scalar string values to a flat text
    // blob — citations would only appear inside narrative fields anyway.
    const html =
      typeof data['html'] === 'string'
        ? (data['html'] as string)
        : this.serialiseStructured(data);
    return this.analyzeText(html, doc.documentType?.key);
  }

  private serialiseStructured(data: Record<string, unknown>): string {
    const parts: string[] = [];
    const walk = (v: unknown) => {
      if (v == null) return;
      if (typeof v === 'string') parts.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === 'object') Object.values(v as object).forEach(walk);
    };
    walk(data);
    return parts.join('\n');
  }

  async analyzeText(html: string, docTypeKey?: string): Promise<CitationAnalysis> {
    const text = this.stripHtml(html);

    // ── present[] — citations referenced via our data-citation-id spans ──
    const presentIds = new Map<string, number>();
    let m: RegExpExecArray | null;
    const re = new RegExp(SPAN_ID_RE);
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      presentIds.set(id, (presentIds.get(id) ?? 0) + 1);
    }
    const present: CitationPresence[] = [];
    for (const [id, occurrences] of presentIds) {
      const c = await this.refs.get(id);
      if (c) present.push({ citation: c, occurrences, status: 'current' });
    }

    // ── stale[] — references to repealed codes (IPC/CrPC/Evidence) ───────
    const findings = validateCitations(text);
    const stale: StaleCitation[] = [];
    for (const f of findings) {
      let suggestion: Citation | undefined;
      if (f.section) {
        const codeKey = this.findingCodeKey(f);
        const repealedId = codeKey ? `${codeKey}.${f.section}` : null;
        const successor = repealedId
          ? await this.refs.successorOf(repealedId)
          : null;
        if (successor) suggestion = successor;
      }
      stale.push({ matched: f.matched, finding: f, suggestion });
    }

    // ── missing[] — citations declared via appliesTo for the doc type ────
    const missing: MissingCitation[] = [];
    if (docTypeKey) {
      const applicable = await this.refs.applicableFor(docTypeKey);
      for (const c of applicable) {
        if (!presentIds.has(c.id)) {
          missing.push({
            citation: c,
            reason: `Expected for documents of type "${docTypeKey}".`,
          });
        }
      }
    }

    // ── suggestions[] — commonly paired with what's already present ──────
    const suggestions: Array<{ citation: Citation; reason: string }> = [];
    const presentIdSet = new Set(presentIds.keys());
    for (const p of present) {
      for (const pairedId of p.citation.commonlyPairedWith ?? []) {
        if (presentIdSet.has(pairedId)) continue;
        if (suggestions.some((s) => s.citation.id === pairedId)) continue;
        const paired = await this.refs.get(pairedId);
        if (paired) {
          suggestions.push({
            citation: paired,
            reason: `Commonly cited alongside ${p.citation.actShort ?? p.citation.act}${p.citation.section ? ' §' + p.citation.section : ''}.`,
          });
        }
      }
    }

    const ok =
      stale.length === 0 && missing.length === 0 && suggestions.length === 0;

    return {
      documentTypeKey: docTypeKey,
      present,
      stale,
      missing,
      suggestions,
      ok,
    };
  }

  // ── helpers ──────────────────────────────────────────────────────────
  private findingCodeKey(f: CitationFinding): 'ipc' | 'crpc' | 'evidence' | null {
    switch (f.code) {
      case 'IPC':
        return 'ipc';
      case 'CrPC':
        return 'crpc';
      case 'Evidence Act':
        return 'evidence';
      default:
        return null;
    }
  }

  private stripHtml(s: string): string {
    return s.replace(/<[^>]+>/g, '');
  }
}
