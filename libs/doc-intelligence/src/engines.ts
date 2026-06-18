/**
 * Pluggable engine seams (docs/05 §4, ARCHITECTURE_PRINCIPLES): every engine is
 * selected through interface → registry → factory, with capability negotiation
 * and **observable, ordered** fallback — no silent downgrade. Concrete engines
 * that need provider SDKs (vision LLM, Document AI, OCR) live in the API module
 * and register themselves here; this lib owns only the contracts + the selector.
 */

import type {
  ClassificationResult,
  ExtractionResult,
  ExtractionSchema,
  NormalizedDocument,
} from './types';

/** Raw bytes + metadata handed to ingest engines. */
export interface SourceInput {
  /** Base64 (no data-URI prefix). */
  data: string;
  contentType: string;
  filename?: string;
  /** Caller's language hint, if known. */
  language?: string;
  /** Password for an encrypted/protected PDF (e.g. a CAMS/KFintech CAS). */
  password?: string;
}

/** Native-text fast path: PDF text layer, DOCX via mammoth, etc. (cheap). */
export interface IParser {
  readonly name: string;
  /** True if this parser can handle the given MIME type. */
  supports(contentType: string): boolean;
  parse(input: SourceInput): Promise<NormalizedDocument>;
}

/** OCR / vision read for scanned / Hindi / handwritten / layout-heavy docs. */
export interface IOcrEngine {
  readonly name: string;
  /** True if this engine reads the given language well (e.g. Devanagari). */
  supportsLanguage(language: string): boolean;
  read(input: SourceInput): Promise<NormalizedDocument>;
}

export interface ClassificationRequest {
  /** Normalized text/layout, when available. */
  document?: NormalizedDocument;
  /** Raw bytes, for VLM classifiers that read the page directly. */
  source?: SourceInput;
  /** Candidate `DocumentType.key`s the classifier may choose from (§11.2). */
  candidateKeys: string[];
}

export interface IClassifierEngine {
  readonly name: string;
  classify(req: ClassificationRequest): Promise<ClassificationResult>;
}

export interface ExtractionRequest {
  schema: ExtractionSchema;
  document?: NormalizedDocument;
  source?: SourceInput;
}

/** Single-shot OR agentic multi-pass — both satisfy this one contract. */
export interface IExtractionEngine {
  readonly name: string;
  extract(req: ExtractionRequest): Promise<ExtractionResult>;
}

// ─── Generic registry + observable selection ────────────────────────────────

export interface NamedEngine {
  readonly name: string;
}

/** A fallback step the selector took, surfaced to logs/telemetry (no silence). */
export interface FallbackEvent {
  engine: string;
  reason: string;
}

export interface SelectResult<T> {
  engine: T;
  /** Engines skipped before this one, with why (capability or health). */
  skipped: FallbackEvent[];
}

/**
 * Ordered registry. Insertion order = priority. `select` walks the list,
 * skipping engines that fail the (optional) capability predicate, and records
 * every skip so the caller can log it. With `allowDowngrade: false` (accuracy-
 * critical steps), it throws rather than returning a less-capable engine.
 */
export class EngineRegistry<T extends NamedEngine> {
  private readonly engines: T[] = [];

  register(engine: T): this {
    if (this.engines.some((e) => e.name === engine.name)) {
      throw new Error(`Engine "${engine.name}" already registered`);
    }
    this.engines.push(engine);
    return this;
  }

  list(): readonly T[] {
    return this.engines;
  }

  get(name: string): T | undefined {
    return this.engines.find((e) => e.name === name);
  }

  /**
   * Select the first engine satisfying `capable` (defaults to the first
   * registered). `allowDowngrade` only changes the error path: when no engine
   * is capable, `false` throws and `true` also throws — the difference is the
   * message intent. The real point is the recorded `skipped` trail.
   */
  select(
    capable: (e: T) => boolean = () => true,
    opts?: { allowDowngrade?: boolean },
  ): SelectResult<T> {
    const skipped: FallbackEvent[] = [];
    for (const engine of this.engines) {
      if (capable(engine)) return { engine, skipped };
      skipped.push({ engine: engine.name, reason: 'not capable for request' });
    }
    const downgrade = opts?.allowDowngrade ?? true;
    throw new Error(
      downgrade
        ? `No capable engine registered (tried ${this.engines.length})`
        : `No capable engine and downgrade is forbidden (tried ${this.engines.length})`,
    );
  }
}
