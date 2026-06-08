# Technical Design — AI Drafting Engine, Court Documents, Multi-Format

> Scope: how to build the Phase A–C upgrades on the existing codebase. Assumes familiarity with
> the current architecture (see [`README.md`](README.md)). Code is illustrative TypeScript —
> verify SDK symbols against the installed `@anthropic-ai/sdk` version before committing.

## 1. The one principle everything obeys

A document type is a `DocumentTypeBundle` in `libs/document-schema` — `schema` (Zod) +
`formMetadata` + `sectionOrder` + `risks` + `prompts` + `knownTemplates`. The AI engine, the form,
the validation, the risk panel, and the renderer **all derive from this single object**. The AI
generation feature is, at its core, _"use the LLM to produce data that validates against
`bundle.schema`, then run the existing render path."_ This is what makes AI drafting reliable
instead of a free-text hallucination machine.

## 2. Adding the Claude provider

The `ai` module already has an `AiProvider` interface (`ai-provider.interface.ts`) with
`openai.provider.ts` and `gemini.provider.ts` behind a fallback chain. Add a third.

### 2.1 SDK choice

Use the **official `@anthropic-ai/sdk`** (the project is TypeScript). The existing providers wrap
LangChain; the Claude provider should call the Anthropic SDK directly for access to
**structured outputs**, **prompt caching**, and **adaptive thinking**, which are the features that
make document generation reliable and cheap. Do not route Claude through a LangChain shim — it
hides exactly the controls we need.

### 2.2 Models, pricing, and routing (verified, cached 2026-05-26)

| Model             | ID                  | Context | Max output | $/1M in | $/1M out | Use for                                                              |
| ----------------- | ------------------- | ------- | ---------- | ------- | -------- | -------------------------------------------------------------------- |
| Claude Opus 4.8   | `claude-opus-4-8`   | 1M      | 128K       | $5.00   | $25.00   | Whole-document generation, court docs, anything correctness-critical |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | 1M      | 64K        | $3.00   | $15.00   | Mid-tier rewrites, bulk operations                                   |
| Claude Haiku 4.5  | `claude-haiku-4-5`  | 200K    | 64K        | $1.00   | $5.00    | Cheap single-clause rewrites, classification, field suggestions      |

**Routing policy:** generation/court docs → Opus 4.8 (default); clause-rewrite → Haiku 4.5 or
Sonnet 4.6; the existing `PromptDefinition.model` alias field already lets each prompt pick its tier.

### 2.3 Provider skeleton

```ts
// apps/api/src/app/ai/providers/claude.provider.ts
import Anthropic from '@anthropic-ai/sdk';
import { AiProvider, GenerateOptions } from './ai-provider.interface';

export class ClaudeProvider implements AiProvider {
  readonly name = 'claude';
  private client = new Anthropic(); // reads ANTHROPIC_API_KEY
  constructor(
    private readonly defaultModel = process.env.ANTHROPIC_MODEL ??
      'claude-opus-4-8',
  ) {}

  isAvailable() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async generate(prompt: string, opts: GenerateOptions = {}) {
    const res = await this.client.messages.create({
      model: opts.model ?? this.defaultModel,
      max_tokens: opts.maxTokens ?? 16000,
      thinking: { type: 'adaptive' }, // Opus 4.8: adaptive only — never budget_tokens
      // NOTE: no temperature/top_p/top_k — removed on Opus 4.8 (would 400)
      system: opts.system,
      messages: [{ role: 'user', content: prompt }],
    });
    return res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('');
  }
  // stream(): use client.messages.stream(...).finalMessage() for max_tokens > ~16k
}
```

Config additions (`apps/api/src/app/config/schema.ts`): `ANTHROPIC_API_KEY` (optional, warn-if-set
without model), `ANTHROPIC_MODEL` (default `claude-opus-4-8`). Mirror the existing OpenAI/Gemini
optional-group pattern. Register `ClaudeProvider` first in the fallback chain.

## 3. Document **generation** (the headline feature)

The reliability trick: don't ask the model for prose, ask it for **schema-conforming JSON** via
structured outputs, then feed that through the _existing_ validation + render path.

### 3.1 Flow

```
NL brief ──▶ LegalAiService.generate(userId, { documentTypeKey, brief })
                 │
                 ├─ requireBundle(key)                    // existing registry
                 ├─ jsonSchema = zodToJsonSchema(bundle.schema)   // derive output schema
                 ├─ Claude messages.create({
                 │     output_config: { format: { type: 'json_schema', schema: jsonSchema } },
                 │     system: bundle.prompts['document.generate'].system,  // new prompt entry
                 │     messages: [{ role: 'user', content: brief }],
                 │  })
                 ├─ data = JSON.parse(...)                 // or client.messages.parse()
                 ├─ bundle.schema.parse(data)              // hard validate — reject if invalid, retry once
                 ├─ warnings = bundle.risks(data)          // deterministic risk pass
                 └─ persist Document(data) + DocumentVersion + append disclaimer
```

**Structured outputs** (`output_config: { format: { type: 'json_schema', schema } }`) are supported
on Opus 4.8 / Sonnet 4.6 / Haiku 4.5 and make the model return JSON that matches the schema.
Caveats to design around: no recursive schemas, no numeric/string length constraints
(`minimum`/`maxLength` are stripped and must be validated client-side — which `bundle.schema.parse`
already does), and `additionalProperties: false` is required on every object. The SDK's
`messages.parse()` validates and returns a typed object.

### 3.2 New prompt-manifest entries

Each doc type's `prompts.ts` gains (the `PromptManifest`/`PromptDefinition` types already exist):

- `document.generate` — system prompt: "You produce data for a `<type>` in `<jurisdiction>`.
  Output must satisfy the provided schema. **Do not invent statutory citations; leave citation
  fields blank for the server to fill.** Use placeholders `{{like_this}}` for unknown party
  details rather than fabricating names." `model: 'claude-opus-4-8'`.
- `document.revise` — see §4.

### 3.3 The intake gap (handling missing fields)

A one-shot generation will invent values for required fields the brief omits. Two options:

1. **Placeholder mode (default):** instruct the model to emit `{{placeholders}}` for unknown
   required fields; the UI's `PlaceholderHighlightExtension` already highlights these for the user
   to fill. Cheapest, no extra round trips.
2. **Conversational intake (flagged):** a tool-use loop — give Claude an `ask_user(question)` tool;
   it calls it for each missing required field; the session pauses, the UI collects answers, the
   loop resumes, then generation runs. More polished, more tokens. Build option 1 first.

## 4. Document **update/revise**

```
existing data + instruction ──▶ Claude (structured output = same schema)
   system: "Apply the user's instruction to this document's data. Return the FULL updated data
            object. Change only what the instruction requires."
   ├─ validate against bundle.schema
   ├─ compute JSON diff (old vs new)
   └─ return diff to UI for accept/reject  ──▶ on accept: write Document + DocumentVersion
```

Returning a **diff for explicit approval** (not silent mutation) is both a UX and a liability
decision — the human stays the author. `DocumentVersion` already snapshots every change, so undo is
free.

## 5. Statutory **citation correctness** — the moat and the liability

**The LLM must never be the source of a section number.** Build:

```
libs/document-schema/src/_shared/citations.ts
  export interface Citation {
    id: string;            // 'bnss.223'
    act: string;           // 'Bharatiya Nagarik Suraksha Sanhita, 2023'
    section: string;       // '223'
    effectiveFrom: string; // '2024-07-01'
    supersedes?: string;   // 'crpc.200'
    summary: string;
  }
```

- The Ai system prompt forbids emitting raw citations; citation _slots_ in the schema are filled
  server-side by looking up this table.
- Court/criminal templates reference `citations` by id, so a statute change is a one-line data edit.
- **New-criminal-codes mapping is mandatory** (see [`01-market-analysis-india.md`](01-market-analysis-india.md) §4.4):
  IPC→BNS, CrPC→BNSS, Evidence Act→BSA, effective 2024-07-01. A model trained on older text will
  default to CrPC §200; the lookup table is what corrects it to BNSS §223.
- Optional (later): RAG over published Bare Acts (Ministry of Law texts, not scraped third-party
  sites) for the Q&A copilot. Not required for generation correctness — the lookup table is.

## 6. Court documents — schema & template scaffolding

Court docs share structural furniture that consumer docs don't. Build it once in
`document-templates/_internals` and `document-schema/_shared`:

- **Cause title** (court name, jurisdiction, case type + number placeholder, year).
- **Memo of parties** (petitioner/applicant vs respondent, with addresses).
- **Body** (facts, grounds — numbered paragraphs).
- **Prayer** ("It is therefore most respectfully prayed…").
- **Verification clause** (place, date, deponent).
- **Vakalatnama** (advocate authorization — its own short doc type, reusable).
- **Advocate block** (name, enrolment/Bar Council number, address) — sourced from `BrandingProfile`.

Each court doc type is then a `DocumentTypeBundle` whose template composes these internals. Page
size = `legal`/`foolscap` (already in the `PageSize` enum), never stamp paper. New `FieldWidget`
values may be needed (e.g. `caseNumber`, `courtSelect` via the existing `lookup` widget +
`LookupGroup` for court directories).

Priority types (see roadmap Phase C): legal notice (incl. §138 NI Act), consumer complaint,
affidavits, bail application (BNSS), plaint/written statement, vakalatnama, writ petition.

## 7. Multi-format export

The PDF pipeline (`ExportsService` → BullMQ `PdfRenderProcessor` → `PdfRendererService` → Puppeteer
hits `apps/artboard/render/:componentKey` → S3 → `DocumentExport`) stays as the canonical visual
renderer. Add formats alongside it:

| Format   | Approach                                                                                               | Notes                                                                                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PDF**  | Existing Puppeteer pipeline                                                                            | Canonical; print-fidelity; stamp-paper aware                                                                                                                                                                                                                               |
| **DOCX** | New worker: either `docx` (npm, programmatic) or headless **LibreOffice** converting the artboard HTML | Advocates **require** editable output. Programmatic `docx` gives cleaner structure but you re-author layout; LibreOffice reuses the HTML but is heavier to host. **Recommend `docx` for court docs (structured, predictable) and accept minor visual drift from the PDF.** |
| **PNG**  | `page.screenshot()` in the same Puppeteer worker                                                       | Thumbnails, share cards; enum already supports it                                                                                                                                                                                                                          |

Wire `DocumentExport.format` through `ExportsService.enqueue(format)` and add a
`DocxRenderProcessor`. Keep checksum + S3 + status semantics identical to the PDF path.

## 8. Cost & performance controls

- **Prompt caching** (Anthropic): cache the stable prefix — system prompt + the doc type's schema +
  few-shot examples — so repeated generations of the same type pay ~0.1× on the cached prefix.
  Cache writes cost ~1.25× (5-min TTL); break-even at two requests. Minimum cacheable prefix is
  **4096 tokens for Opus 4.8/Haiku 4.5** and **2048 for Sonnet 4.6** — a short system prompt won't
  cache, so keep the cached prefix (schema + examples) above the floor. Put volatile content (the
  user's brief) _after_ the last cache breakpoint. Verify with `usage.cache_read_input_tokens`.
- **Model tiering**: Opus for generation, Haiku/Sonnet for rewrites (already expressible via
  `PromptDefinition.model`).
- **Existing 24h cache** in `legal-ai.service` (SHA256 of prompt id+version+input) stays — extend it
  to keyed-by-(type, brief) for generation.
- **Metering**: every call decrements `WalletUsage` via `wallet-usage.service.ts`. No anonymous AI.
- **Streaming**: for `max_tokens > ~16k` (long court docs), use `client.messages.stream()` +
  `.finalMessage()` to avoid SDK HTTP timeouts. Stream tokens to the builder UI for perceived speed.

## 9. Guardrails (non-negotiable)

1. Disclaimer appended to **every** AI output ("AI-suggested; review with a qualified advocate
   before binding use") — already implemented in `legal-ai.service`; keep it on generation/revision.
2. **PII stripped from logged prompts.**
3. Refuse to generate anything impersonating a court/judicial order or authority.
4. **No model-authored statutory citations** — server fills citation slots from the lookup table.
5. **eSign hard-gated off** for IT-Act-Schedule-1 doc types (wills, PoA, trusts, immovable-property
   conveyance) — enforce at the `DocumentType` level.
6. **DPDP consent gate** before any Aadhaar/PAN OCR ("upload-to-fill") feature; encrypt at rest;
   support deletion.

## 10. Build order (maps to roadmap Phase A–C)

1. `ClaudeProvider` + config + register in fallback chain.
2. `zodToJsonSchema` helper + `LegalAiService.generate` + `document.generate` prompt for
   `rent_agreement` (prove the pattern on the one type that already exists end-to-end).
3. Builder UI: "Draft with AI" + accept/reject diff for revise.
4. `LegalAiService.revise`.
5. DOCX export worker.
6. `citations.ts` + court-document `_internals` scaffolding.
7. First court type: legal notice (§138). Then bail application (BNSS). Then plaint + vakalatnama.

## 11. Open technical questions (decide before/while building)

- **DOCX engine**: programmatic `docx` (clean, re-author layout) vs headless LibreOffice (reuse
  HTML, heavier ops). Leaning `docx` for court docs.
- **Intake**: placeholder mode (ship first) vs conversational tool-use loop (polish later).
- **Citation library sourcing**: hand-curate the high-frequency sections first (§138 NI Act, BNSS
  bail provisions, Consumer Protection Act 2019) vs attempt comprehensive coverage (don't — start
  narrow, expand by usage).
- **RAG over Bare Acts**: needed only for the Q&A copilot, not for generation. Defer.
