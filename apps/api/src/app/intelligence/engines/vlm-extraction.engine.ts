import { Logger } from '@nestjs/common';
import {
  buildCriticPrompt,
  buildExtractionToolSchema,
  buildExtractPrompt,
  computeOverallConfidence,
  lowConfidenceFields,
  mergeCritic,
  subSchema,
  type ConfidenceMap,
  type ExtractionRequest,
  type ExtractionResult,
  type ExtractionSchema,
  type FieldValues,
  type IExtractionEngine,
  type Provenance,
} from '@org/doc-intelligence';
import type { AiService } from '../../ai/ai.service';
import type {
  MultimodalInput,
  MultimodalPart,
} from '../../ai/providers/ai-provider.interface';

/** What the forced tool returns: values + sibling confidence/provenance maps. */
interface ToolOutput {
  fields?: FieldValues;
  field_confidence?: Record<string, number>;
  field_provenance?: Record<string, { page?: number }>;
}

/**
 * VLM-native, single-shot extraction engine (docs/05 §4). Sends the raw
 * document (PDF/image) straight to a vision-capable provider via `AiService`
 * and forces schema-shaped JSON. Per-field confidence is requested inline; the
 * agentic critic re-verification pass (§3) is a Phase-1 layer on top of this.
 *
 * `source` (raw bytes) is preferred — Claude reads PDFs/scans natively, so we
 * skip a lossy text flattening. Falls back to normalized text when only that
 * is available.
 */
export class VlmExtractionEngine implements IExtractionEngine {
  readonly name = 'vlm-single-shot';
  private readonly logger = new Logger(VlmExtractionEngine.name);

  constructor(private readonly ai: AiService) {}

  async extract(req: ExtractionRequest): Promise<ExtractionResult> {
    const { system, instruction } = buildExtractPrompt(req.schema);
    return this.runOnce(req, req.schema, system, instruction);
  }

  /**
   * Agentic critic re-verification (docs/05 §3). Re-extracts only the fields the
   * first pass was unsure about and merges the higher-confidence values. A
   * no-op (returns the primary result) when nothing is below threshold.
   */
  async critique(
    req: ExtractionRequest,
    primary: ExtractionResult,
    threshold: number,
  ): Promise<ExtractionResult> {
    const lowConf = lowConfidenceFields(req.schema, primary, threshold);
    if (lowConf.length === 0) return primary;

    const sub = subSchema(req.schema, lowConf);
    const { system, instruction } = buildCriticPrompt(req.schema, lowConf);
    const second = await this.runOnce({ ...req, schema: sub }, sub, system, instruction);
    const merged = mergeCritic(req.schema, primary, second);
    this.logger.debug(
      `critic rechecked ${lowConf.length} field(s); overall ${primary.overallConfidence.toFixed(2)} → ${merged.overallConfidence.toFixed(2)}`,
    );
    return merged;
  }

  /** One forced-tool extraction over `schema` with the given prompt. */
  private async runOnce(
    req: ExtractionRequest,
    schema: ExtractionSchema,
    system: string,
    instruction: string,
  ): Promise<ExtractionResult> {
    const toolSchema = buildExtractionToolSchema(schema);
    const input = this.buildInput(req, instruction);

    const { data, model, provider } = await this.ai.extract<ToolOutput>(
      input,
      toolSchema,
      {
        systemPrompt: system,
        schemaName: 'record_extraction',
        instruction,
      },
    );

    const fields: FieldValues = data.fields ?? {};
    const confidence: ConfidenceMap = {};
    for (const key of Object.keys(fields)) {
      const score = data.field_confidence?.[key];
      const page = data.field_provenance?.[key]?.page;
      const provenance: Provenance = {
        source: req.source ? 'vlm' : 'native_text',
        ...(page ? { page } : {}),
      };
      confidence[key] = {
        // Default unconfident when the model omits a score — fail toward review.
        confidence: typeof score === 'number' ? clamp01(score) : 0.5,
        provenance,
      };
    }

    const overallConfidence = computeOverallConfidence(schema, fields, confidence);
    this.logger.debug(
      `extracted ${Object.keys(fields).length} fields via ${provider}:${model} (overall ${overallConfidence.toFixed(2)})`,
    );

    return {
      schemaKey: schema.key,
      documentTypeKey: schema.documentTypeKey,
      fields,
      confidence,
      overallConfidence,
    };
  }

  private buildInput(
    req: ExtractionRequest,
    instruction: string,
  ): MultimodalInput {
    const parts: MultimodalPart[] = [{ kind: 'text', text: instruction }];
    if (req.source) {
      parts.push(sourcePart(req.source.contentType, req.source.data));
    } else if (req.document) {
      const text = req.document.pages
        .map((p) => `--- Page ${p.page} ---\n${p.text}`)
        .join('\n\n');
      parts.push({ kind: 'text', text: `\n\nDocument text:\n${text}` });
    }
    return parts;
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** A PDF becomes a `document` part; anything else (png/jpeg) an `image` part. */
export function sourcePart(contentType: string, data: string): MultimodalPart {
  return contentType === 'application/pdf'
    ? { kind: 'document', mediaType: contentType, data }
    : { kind: 'image', mediaType: contentType, data };
}
