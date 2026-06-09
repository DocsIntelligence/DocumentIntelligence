import { Logger } from '@nestjs/common';
import {
  buildClassificationSchema,
  buildClassifyPrompt,
  type ClassificationRequest,
  type ClassificationResult,
  type IClassifierEngine,
} from '@org/doc-intelligence';
import type { AiService } from '../../ai/ai.service';
import type {
  MultimodalInput,
  MultimodalPart,
} from '../../ai/providers/ai-provider.interface';
import { sourcePart } from './vlm-extraction.engine';

interface ClassifyOutput {
  documentTypeKey?: string | null;
  confidence?: number;
}

/**
 * VLM classifier (docs/05 §4, §11.2). Emits the generator's `DocumentType.key`
 * when the upload matches a known type — the shared vocabulary that lets
 * convert route straight into a `DocumentTypeBundle` with no translation layer.
 * Returns `null` when no candidate fits (→ generic schema → freeform convert).
 */
export class ClassifierEngine implements IClassifierEngine {
  readonly name = 'vlm-classifier';
  private readonly logger = new Logger(ClassifierEngine.name);

  constructor(private readonly ai: AiService) {}

  async classify(req: ClassificationRequest): Promise<ClassificationResult> {
    if (req.candidateKeys.length === 0) {
      return { documentTypeKey: null, confidence: 0 };
    }
    const { system, instruction } = buildClassifyPrompt(req.candidateKeys);
    const schema = buildClassificationSchema(req.candidateKeys);

    const { data } = await this.ai.extract<ClassifyOutput>(
      this.buildInput(req, instruction),
      schema,
      { systemPrompt: system, schemaName: 'classify_document', instruction },
    );

    const key =
      data.documentTypeKey && req.candidateKeys.includes(data.documentTypeKey)
        ? data.documentTypeKey
        : null;
    const confidence = clamp01(data.confidence ?? (key ? 0.5 : 0));
    this.logger.debug(`classified as ${key ?? 'none'} (${confidence.toFixed(2)})`);
    return { documentTypeKey: key, confidence };
  }

  private buildInput(
    req: ClassificationRequest,
    instruction: string,
  ): MultimodalInput {
    const parts: MultimodalPart[] = [{ kind: 'text', text: instruction }];
    if (req.source) {
      parts.push(sourcePart(req.source.contentType, req.source.data));
    } else if (req.document) {
      // First page is usually enough to classify — keep the prompt cheap.
      const head = req.document.pages
        .slice(0, 2)
        .map((p) => p.text)
        .join('\n');
      parts.push({ kind: 'text', text: `\n\nDocument text:\n${head}` });
    }
    return parts;
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
