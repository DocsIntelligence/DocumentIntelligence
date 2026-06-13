import { Injectable, Logger } from '@nestjs/common';
import { getBundle } from '@org/document-schema';
import type { FormMetadata } from '@org/document-schema';
import { DatabaseService } from '../database/database.service';

/** What gets written into a SearchIndex row for one entity. */
export interface ExtractedText {
  title: string;
  bodyText: string;
  ownerUserId: string | null;
  ownerOrgId: string | null;
  type: string | null;
  status: string | null;
  refUpdatedAt: Date | null;
}

const MAX_BODY_CHARS = 60_000;

/** Strip HTML to readable text: drop script/style, tags → spaces, decode a few
 *  common entities, collapse whitespace. Deliberately dependency-free (the API
 *  must not import the React template renderers). */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

@Injectable()
export class SearchTextService {
  private readonly logger = new Logger(SearchTextService.name);

  constructor(private readonly db: DatabaseService) {}

  // ── Documents (drafting world) ─────────────────────────────────────────

  /** Build searchable text for a Document. Freeform docs render HTML with the
   *  values filled in; structured docs walk their `data` resolving human field
   *  labels from the DocumentTypeBundle (server-safe — schema lib only). */
  async forDocument(documentId: string): Promise<ExtractedText | null> {
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      include: { documentType: { select: { key: true } } },
    });
    if (!doc) return null;

    const typeKey = doc.documentType?.key ?? null;
    const data = (doc.data ?? {}) as Record<string, unknown>;
    let bodyText: string;

    if (typeKey === 'freeform') {
      bodyText = this.freeformText(data);
    } else if (typeKey) {
      bodyText = this.structuredText(typeKey, data);
    } else {
      bodyText = this.collectScalars(data).join(' ');
    }

    return {
      title: doc.title,
      bodyText: bodyText.slice(0, MAX_BODY_CHARS),
      ownerUserId: doc.ownerUserId,
      ownerOrgId: doc.ownerOrgId,
      type: typeKey,
      status: doc.status,
      refUpdatedAt: doc.updatedAt,
    };
  }

  private freeformText(data: Record<string, unknown>): string {
    const values = (data['values'] ?? {}) as Record<string, string>;
    const html = typeof data['html'] === 'string' ? (data['html'] as string) : '';
    // Fill placeholders with their values (missing → keep the token name word).
    const filled = html.replace(PLACEHOLDER_RE, (_m, key: string) =>
      values[key] != null ? String(values[key]) : key.replace(/_/g, ' '),
    );
    const parts = [htmlToText(filled)];
    // Also fold in raw values + field labels in case the HTML omits some.
    const fields = (data['fields'] ?? []) as Array<{ key: string; label?: string }>;
    for (const f of fields) {
      const v = values[f.key];
      if (v != null && String(v).trim()) parts.push(`${f.label ?? f.key}: ${v}`);
    }
    return parts.join('\n');
  }

  private structuredText(typeKey: string, data: Record<string, unknown>): string {
    const bundle = getBundle(typeKey);
    const meta = bundle?.formMetadata;
    const lines: string[] = [];
    this.walk(data, '', meta, lines);
    return lines.join('\n');
  }

  /** Recursively walk nested doc data, emitting "Label: value" lines and
   *  recursing into arrays/objects. Labels resolved from form metadata when
   *  the path (or its item-relative path under a group) is known. */
  private walk(
    node: unknown,
    path: string,
    meta: FormMetadata | undefined,
    out: string[],
  ): void {
    if (node == null) return;
    if (Array.isArray(node)) {
      const itemMeta = meta?.[path]?.itemFields;
      for (const item of node) this.walk(item, '', itemMeta, out);
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        const childPath = path ? `${path}.${k}` : k;
        this.walk(v, childPath, meta, out);
      }
      return;
    }
    // scalar
    const str = String(node).trim();
    if (!str) return;
    // For group items, meta is item-scoped so the relative key is the path.
    const label = meta?.[path]?.label;
    out.push(label ? `${label}: ${str}` : str);
  }

  private collectScalars(node: unknown, acc: string[] = []): string[] {
    if (node == null) return acc;
    if (Array.isArray(node)) {
      for (const v of node) this.collectScalars(v, acc);
    } else if (typeof node === 'object') {
      for (const v of Object.values(node as Record<string, unknown>))
        this.collectScalars(v, acc);
    } else {
      const s = String(node).trim();
      if (s) acc.push(s);
    }
    return acc;
  }

  // ── Source documents (intelligence world) ──────────────────────────────

  /** Build searchable text for an uploaded SourceDocument: parsed page text +
   *  the latest analysis summary + the latest extraction's field values. */
  async forSource(sourceDocumentId: string): Promise<ExtractedText | null> {
    const src = await this.db.sourceDocument.findUnique({
      where: { id: sourceDocumentId },
      include: {
        analyses: { orderBy: { createdAt: 'desc' }, take: 1 },
        extractions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!src) return null;

    const parts: string[] = [];

    // Parsed page text (NormalizedDocument { pages: [{ page, text }] }).
    const norm = src.normalizedText as { pages?: Array<{ text?: string }> } | null;
    if (norm?.pages?.length) {
      parts.push(norm.pages.map((p) => p.text ?? '').join('\n\n'));
    }

    // Latest analysis: summary + flattened structured findings.
    const analysis = src.analyses?.[0];
    if (analysis) {
      if (analysis.summary) parts.push(analysis.summary);
      for (const key of ['parties', 'keyDates', 'obligations', 'riskFlags'] as const) {
        const v = analysis[key];
        if (v) parts.push(this.collectScalars(v).join(' '));
      }
    }

    // Latest extraction field values.
    const extraction = src.extractions?.[0];
    if (extraction?.fields) {
      parts.push(this.collectScalars(extraction.fields).join(' '));
    }

    const bodyText = parts.filter(Boolean).join('\n\n').slice(0, MAX_BODY_CHARS);
    return {
      title: src.filename,
      bodyText,
      ownerUserId: src.ownerUserId,
      ownerOrgId: src.ownerOrgId,
      type: extraction?.documentTypeKey ?? null,
      status: src.status,
      refUpdatedAt: src.updatedAt,
    };
  }
}
