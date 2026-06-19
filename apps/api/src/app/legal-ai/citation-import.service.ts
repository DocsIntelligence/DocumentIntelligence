import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ParsingService,
  PdfPasswordRequiredError,
} from '../intelligence/parsing.service';
import { LegalReferenceService } from './legal-reference.service';

/** One section parsed out of a bare-act PDF. The text is VERBATIM from the
 *  document — never model-generated (the citation moat: the AI must not author
 *  statute text). `title` is a best-effort heading lifted from the section's
 *  own marginal note; it, and nothing else, is heuristic. */
export interface ParsedStatuteSection {
  /** Citation slug, e.g. `bns.103`. */
  id: string;
  /** Section number as printed, e.g. "103". */
  section: string;
  /** Marginal-note heading, best-effort (e.g. "Punishment for murder"). */
  title: string;
  /** Verbatim section text from the PDF. */
  fullText: string;
  // ── Optional per-section fields (populated by the JSON-import path, where
  //    the uploader supplies fully-formed records). When present they WIN over
  //    the batch-level defaults at commit time. The PDF path leaves them unset. ──
  summary?: string;
  draftingTips?: string;
  topics?: string[];
  appliesTo?: string[];
  confidence?: 'high' | 'moderate' | 'low';
  supersedes?: string;
  externalUrl?: string;
  effectiveFrom?: string;
  verifyNote?: string;
  act?: string;
  actShort?: string;
}

export interface ParseStatutePdfOptions {
  /** Slug prefix for generated ids, e.g. `bns` → `bns.103`. */
  codePrefix: string;
  /** Full act name, e.g. "Bharatiya Nyaya Sanhita, 2023". */
  actName: string;
  /** Short label, e.g. "BNS". */
  actShort?: string;
  /** Stop after this section number (safety cap; default 1000). */
  maxSection?: number;
  /** Password for a protected PDF. */
  password?: string;
}

export interface CommitStatuteSectionsOptions extends ParseStatutePdfOptions {
  /** Topic tags applied to every imported citation. */
  topics?: string[];
  /** ISO date the act took effect (BNS/BNSS/BSA → 2024-07-01). */
  effectiveFrom?: string;
  /** Canonical-source link for the "Full text →" page. */
  externalUrl?: string;
  /** confidence chip — default 'moderate' (text is faithful; summary stubbed). */
  confidence?: 'high' | 'moderate' | 'low';
  /** Overwrite an existing citation with the same id (default: skip it). */
  overwriteExisting?: boolean;
}

/** Lightweight per-section row for the review UI — NO full text (a 112-page act
 *  is ~358 sections, far past Express's JSON body limit if we shipped it all). */
export interface StatuteSectionPreview {
  id: string;
  section: string;
  title: string;
  charCount: number;
  /** First ~200 chars, for a sanity glance. */
  snippet: string;
}

/** A parse staged in memory, awaiting a commit decision. */
interface StagedImport {
  sections: ParsedStatuteSection[];
  opts: CommitStatuteSectionsOptions;
  expiresAt: number;
}

/** How long a parsed-but-uncommitted import lives before it's swept. */
const STAGE_TTL_MS = 20 * 60 * 1000;
/** Sections committed per batch (keeps each unit of work small + loggable). */
const COMMIT_BATCH = 25;

/**
 * Bulk-imports the sections of a bare-act PDF into the citation catalog.
 *
 * Flow is deliberately two-step — **parse → preview → commit** — so a human
 * reviews what was segmented before any rows are written (PDF text layers are
 * messy and section detection is heuristic). The section *text* is taken
 * verbatim; only the *heading* is guessed, and only the human-written `summary`
 * (the explainer IP) is left blank for later curation.
 */
@Injectable()
export class CitationImportService {
  private readonly logger = new Logger(CitationImportService.name);

  /** Parsed-but-uncommitted imports, keyed by a short-lived importId. In-memory
   *  by design: the parse→review→commit round-trip is seconds long and admin-
   *  scoped. A restart just means re-uploading the PDF (the parse is cheap and
   *  deterministic). Not multi-instance shared — acceptable for an admin tool. */
  private readonly staged = new Map<string, StagedImport>();

  constructor(
    private readonly parsing: ParsingService,
    private readonly legalRef: LegalReferenceService,
  ) {}

  // ── Staged parse → review → batched commit (handles large PDFs) ────────────

  /**
   * Parse + segment a (possibly large, 100+ page) PDF, stash the full result
   * server-side, and return only a LIGHTWEIGHT preview (no full text). The
   * client reviews the preview and commits by `importId` — so a big act never
   * has to round-trip its full text through the browser or the JSON body.
   */
  async beginImport(
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    opts: CommitStatuteSectionsOptions,
  ): Promise<{
    importId: string;
    preview: StatuteSectionPreview[];
    totalChars: number;
    detectedCount: number;
    warnings: string[];
  }> {
    this.sweep();
    const { sections, totalChars, warnings } = await this.parsePdf(file, opts);
    return this.stage(sections, opts, totalChars, warnings);
  }

  /**
   * Import from a JSON array of citation records (the uploader generates them —
   * e.g. with an LLM — so summary + every field is exactly what they want).
   * Same stage→preview→commit path as the PDF importer; per-record fields win
   * over the batch defaults at commit time.
   */
  async beginJsonImport(
    jsonText: string,
    opts: CommitStatuteSectionsOptions,
  ): Promise<{
    importId: string;
    preview: StatuteSectionPreview[];
    totalChars: number;
    detectedCount: number;
    warnings: string[];
  }> {
    this.sweep();
    let raw: unknown;
    try {
      raw = JSON.parse(jsonText);
    } catch (e) {
      throw new BadRequestException(
        `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    // Accept either a bare array or { sections: [...] } / { citations: [...] }.
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { sections?: unknown }).sections)
        ? (raw as { sections: unknown[] }).sections
        : Array.isArray((raw as { citations?: unknown }).citations)
          ? (raw as { citations: unknown[] }).citations
          : null;
    if (!arr) {
      throw new BadRequestException(
        'Expected a JSON array of citation objects (or { "sections": [...] }).',
      );
    }

    const warnings: string[] = [];
    const sections: ParsedStatuteSection[] = [];
    const seen = new Set<string>();
    let skipped = 0;
    arr.forEach((item, i) => {
      const parsed = this.fromJsonItem(item, opts, i);
      if (!parsed) {
        skipped += 1;
        return;
      }
      if (seen.has(parsed.id)) {
        warnings.push(`Duplicate id "${parsed.id}" in the file — kept the first.`);
        return;
      }
      seen.add(parsed.id);
      sections.push(parsed);
    });
    if (skipped > 0) {
      warnings.push(
        `${skipped} record(s) skipped — each needs at least a section number or an id, plus a title.`,
      );
    }
    if (sections.length === 0) {
      warnings.push('No importable records found in the JSON.');
    }

    const totalChars = sections.reduce(
      (n, s) => n + (s.fullText?.length ?? 0) + (s.summary?.length ?? 0),
      0,
    );
    return this.stage(sections, opts, totalChars, warnings);
  }

  /** Map one loose JSON object → a staged section, or null if unusable. */
  private fromJsonItem(
    item: unknown,
    opts: CommitStatuteSectionsOptions,
    index: number,
  ): ParsedStatuteSection | null {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined;
    const strArr = (v: unknown): string[] | undefined =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string' && !!x.trim())
        : undefined;
    const conf = (v: unknown): 'high' | 'moderate' | 'low' | undefined =>
      v === 'high' || v === 'moderate' || v === 'low' ? v : undefined;

    const section =
      str(o['section']) ??
      (typeof o['section'] === 'number' ? String(o['section']) : undefined);
    let id = str(o['id']);
    if (!id && section) id = `${opts.codePrefix}.${section}`;
    if (!id) return null; // no way to key this record
    const title = str(o['title']);
    if (!title && !str(o['summary']) && !str(o['fullText'])) return null;

    return {
      id,
      section: section ?? id.split('.').pop() ?? String(index + 1),
      title: title ?? '',
      fullText: str(o['fullText']) ?? '',
      summary: str(o['summary']),
      draftingTips: str(o['draftingTips']),
      topics: strArr(o['topics']),
      appliesTo: strArr(o['appliesTo']),
      confidence: conf(o['confidence']),
      supersedes: str(o['supersedes']),
      externalUrl: str(o['externalUrl']),
      effectiveFrom: str(o['effectiveFrom']),
      verifyNote: str(o['verifyNote']),
      act: str(o['act']),
      actShort: str(o['actShort']),
    };
  }

  /** Stash sections + return the lightweight preview. */
  private stage(
    sections: ParsedStatuteSection[],
    opts: CommitStatuteSectionsOptions,
    totalChars: number,
    warnings: string[],
  ): {
    importId: string;
    preview: StatuteSectionPreview[];
    totalChars: number;
    detectedCount: number;
    warnings: string[];
  } {
    const importId = randomUUID();
    this.staged.set(importId, {
      sections,
      opts,
      expiresAt: Date.now() + STAGE_TTL_MS,
    });
    const preview = sections.map((s) => {
      const body = s.fullText || s.summary || '';
      return {
        id: s.id,
        section: s.section,
        title: s.title,
        charCount: body.length,
        snippet: body.slice(0, 200),
      };
    });
    return {
      importId,
      preview,
      totalChars,
      detectedCount: sections.length,
      warnings,
    };
  }

  /**
   * Commit a staged import in batches. `includeIds` (when given) limits the
   * commit to the sections the reviewer kept; otherwise every parsed section is
   * written. Overrides on `opts` (e.g. overwriteExisting) are merged over the
   * options captured at parse time.
   */
  async commitImport(
    importId: string,
    override: { includeIds?: string[]; overwriteExisting?: boolean } = {},
  ): Promise<{ created: string[]; skipped: string[]; total: number }> {
    this.sweep();
    const stage = this.staged.get(importId);
    if (!stage) {
      throw new NotFoundException(
        'This import has expired or was already used — re-upload the PDF.',
      );
    }
    const include = override.includeIds
      ? new Set(override.includeIds)
      : null;
    const chosen = include
      ? stage.sections.filter((s) => include.has(s.id))
      : stage.sections;
    const opts: CommitStatuteSectionsOptions = {
      ...stage.opts,
      overwriteExisting:
        override.overwriteExisting ?? stage.opts.overwriteExisting,
    };

    const created: string[] = [];
    const skipped: string[] = [];
    for (let i = 0; i < chosen.length; i += COMMIT_BATCH) {
      const batch = chosen.slice(i, i + COMMIT_BATCH);
      const res = await this.commit(batch, opts);
      created.push(...res.created);
      skipped.push(...res.skipped);
      this.logger.log(
        `Import ${importId}: committed ${Math.min(i + COMMIT_BATCH, chosen.length)}/${chosen.length}`,
      );
    }
    this.staged.delete(importId);
    return { created, skipped, total: chosen.length };
  }

  /** Drop expired staged imports (called opportunistically on each operation). */
  private sweep(): void {
    const now = Date.now();
    for (const [id, s] of this.staged) {
      if (s.expiresAt <= now) this.staged.delete(id);
    }
  }

  /** Parse a PDF and segment it into sections. Pure read — writes nothing. */
  async parsePdf(
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    opts: ParseStatutePdfOptions,
  ): Promise<{
    sections: ParsedStatuteSection[];
    totalChars: number;
    warnings: string[];
  }> {
    let normalized;
    try {
      normalized = await this.parsing.parse({
        data: file.buffer.toString('base64'),
        contentType: file.mimetype || 'application/pdf',
        filename: file.originalname,
        password: opts.password,
      });
    } catch (e) {
      if (e instanceof PdfPasswordRequiredError) {
        throw new BadRequestException({
          code: e.incorrect ? 'PDF_PASSWORD_INCORRECT' : 'PDF_PASSWORD_REQUIRED',
          message: e.message,
        });
      }
      throw e;
    }

    if (!normalized) {
      throw new BadRequestException(
        'No text layer found in this PDF (it is likely scanned). OCR is not wired into the importer — upload a text-based PDF.',
      );
    }

    const text = normalized.pages
      .map((p) => p.text)
      .join('\n\n')
      .replace(/\r\n/g, '\n');
    const totalChars = text.length;

    const sections = this.segment(text, opts);
    const warnings: string[] = [];
    if (sections.length === 0) {
      warnings.push(
        'No sections detected. The PDF text may be unusual — check that section numbers print as "1.", "2.", … at line starts.',
      );
    } else if (sections.length < 10) {
      warnings.push(
        `Only ${sections.length} section(s) detected — that looks low for a full act. Review carefully before importing.`,
      );
    }
    const short = sections.filter((s) => s.fullText.length < 40).length;
    if (short > 0) {
      warnings.push(
        `${short} section(s) have very little text — they may be index/“arrangement of sections” entries rather than real provisions.`,
      );
    }

    return { sections, totalChars, warnings };
  }

  /** Write reviewed sections to the catalog. Returns a per-id outcome. */
  async commit(
    sections: ParsedStatuteSection[],
    opts: CommitStatuteSectionsOptions,
  ): Promise<{
    created: string[];
    skipped: string[];
    total: number;
  }> {
    const created: string[] = [];
    const skipped: string[] = [];

    for (const s of sections) {
      if (!opts.overwriteExisting) {
        const existing = await this.legalRef.getAdmin(s.id);
        if (existing) {
          skipped.push(s.id);
          continue;
        }
      }
      // Per-section values (from a JSON upload) WIN over the batch defaults.
      // The summary is the human-explainer IP: a JSON record supplies a real
      // one; the bare PDF path leaves a neutral stub (never model-authored).
      const hasOwnSummary = !!s.summary && s.summary.trim().length > 0;
      await this.legalRef.createOrUpdate({
        id: s.id,
        act: s.act ?? opts.actName,
        actShort: s.actShort ?? opts.actShort,
        section: s.section,
        title: s.title || `Section ${s.section}`,
        summary: hasOwnSummary
          ? s.summary
          : `Section ${s.section} of the ${s.act ?? opts.actName}. Imported in bulk; summary pending review.`,
        fullText: s.fullText || undefined,
        draftingTips: s.draftingTips,
        externalUrl: s.externalUrl ?? opts.externalUrl,
        effectiveFrom: s.effectiveFrom ?? opts.effectiveFrom ?? undefined,
        supersedes: s.supersedes,
        confidence: s.confidence ?? opts.confidence ?? 'moderate',
        verifyNote:
          s.verifyNote ??
          (hasOwnSummary
            ? 'Bulk-imported from an uploaded record — verify against the official bare act before binding use.'
            : 'Bulk-imported; heading auto-detected and summary unwritten — verify before binding use.'),
        topics: s.topics ?? opts.topics ?? [],
        appliesTo: s.appliesTo,
        isActive: true,
        isPublic: false,
      });
      created.push(s.id);
    }

    return { created, skipped, total: sections.length };
  }

  // ── Segmentation ──────────────────────────────────────────────────────────

  /**
   * Walk the text section-by-section. We look for the NEXT expected number
   * (n, then n+1, …) at a line start, which makes us robust to stray "5."
   * tokens inside a section body — we only ever advance to the number we're
   * looking for. Everything between consecutive markers is that section's text.
   */
  private segment(
    fullText: string,
    opts: ParseStatutePdfOptions,
  ): ParsedStatuteSection[] {
    const max = opts.maxSection ?? 1000;
    // Skip front matter (cover + "arrangement of sections" index) when we can
    // find the enacting formula or Chapter I — the real provisions follow it.
    const text = this.skipFrontMatter(fullText);

    const out: ParsedStatuteSection[] = [];
    let n = 1;
    let start = this.findSectionStart(text, n, 0);
    if (start === -1) return out;

    while (start !== -1 && n <= max) {
      const nextStart = this.findSectionStart(text, n + 1, start + 1);
      const body = (
        nextStart === -1 ? text.slice(start) : text.slice(start, nextStart)
      ).trim();
      out.push(this.toSection(n, body, opts.codePrefix));
      if (nextStart === -1) break;
      n += 1;
      start = nextStart;
    }
    return out;
  }

  /** Index of a line-anchored "N. " in `text` at/after `from`, or -1. */
  private findSectionStart(text: string, n: number, from: number): number {
    // Number must open a line (allow leading spaces) and be followed by text —
    // bare-act sub-clauses use "(1)"/"(a)", so a line-leading "N." is a section.
    const re = new RegExp(`(?:^|\\n)[ \\t]*${n}\\.[ \\t]+(?=\\S)`, 'g');
    re.lastIndex = from;
    const m = re.exec(text);
    if (!m) return -1;
    // Point at the digit, not the preceding newline.
    return m.index + (text[m.index] === '\n' ? 1 : 0);
  }

  private skipFrontMatter(text: string): string {
    const markers = [/be it enacted/i, /\bchapter\s+i\b(?!\w)/i];
    let best = -1;
    for (const re of markers) {
      const m = re.exec(text);
      if (m && (best === -1 || m.index < best)) best = m.index;
    }
    return best > 0 ? text.slice(best) : text;
  }

  private toSection(
    n: number,
    body: string,
    codePrefix: string,
  ): ParsedStatuteSection {
    // Strip the leading "N." marker for heading detection.
    const afterNum = body.replace(/^\s*\d+\.[ \t]+/, '');
    const title = this.extractHeading(afterNum);
    return {
      id: `${codePrefix}.${n}`,
      section: String(n),
      title,
      fullText: this.tidy(body),
    };
  }

  /** Bare acts print the marginal note before the provision, set off by an
   *  em-dash: "Punishment for murder.—(1) Whoever…". Take the run up to the
   *  first em/en/double-dash if it is short and heading-like; else give up. */
  private extractHeading(afterNum: string): string {
    const dash = afterNum.search(/[–—]|\.--|\.—|--/);
    if (dash > 0 && dash <= 160) {
      const h = afterNum
        .slice(0, dash)
        .replace(/\.$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (h.length >= 2 && /[a-zA-Z]/.test(h)) return h;
    }
    return '';
  }

  /** Collapse runaway whitespace from PDF extraction while keeping paragraphs. */
  private tidy(s: string): string {
    return s
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/ *\n */g, '\n')
      .trim();
  }
}
