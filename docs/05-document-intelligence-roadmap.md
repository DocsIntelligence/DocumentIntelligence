# Document Intelligence — Roadmap v2 (research-backed, customizable)

**Status:** proposal · **Supersedes:** v1 (single-author draft) · **Updated:** 2026-06-09

v2 is informed by (a) an internal **POC** (a 2nd-gen IDP ops platform: DB-driven
workflow engine, classify→extract→review, parser/provider registries) and
(b) **current industry research** (Section 3). It keeps the original premise —
ingest an _existing_ document, **understand** it (extract / analyse), and
optionally **convert** it into an editable platform document — but re-centers the
architecture on what 2026 buyers actually expect, and defers the heavy workflow
machinery the POC leads with.

> **Scope boundary — do NOT mix with the drafting flow.** New module + lib + data
> model. The single sanctioned bridge is one-directional: a finished extraction
> may _create_ a `freeform` `Document` for the existing editor (Phase 3).
> Nothing here edits `Document`/`DocumentVersion`/editor code. See §10.

---

## 1. Verdict on the POC — adopt / fix / defer / reject

| POC element                                                                                      | Verdict                         | Why                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interface + registry + factory (parsers, AI providers, storage)                                  | **Adopt**                       | Matches this repo's existing `AiProvider` pattern; adding a format/engine never touches call sites.                                                                                                       |
| Atomic state-change **+ audit in one `$transaction`**                                            | **Adopt**                       | Non-negotiable for a legal/compliance product.                                                                                                                                                            |
| **Provenance on every human edit** (`originalValue`, `editedBy`…)                                | **Adopt + extend**              | Extend provenance to every _AI_ field (page + bbox), which 2026 IDP treats as table stakes.                                                                                                               |
| Whitelist `provider:model` + fail fast                                                           | **Adopt**                       | Cheap guardrail; avoids spending on invalid combos.                                                                                                                                                       |
| Idempotent stage-guarded async + **cron reconciler** for stuck docs                              | **Adopt**                       | Crash-resilience; we already run BullMQ (PDF export) + can add a reconciler.                                                                                                                              |
| Inline **cost/latency telemetry** per doc                                                        | **Adopt**                       | Map onto existing `WalletUsage`; attribute spend per doc/model.                                                                                                                                           |
| **Config-from-DB → prompts-from-config** (DocType + FieldDefinition drive prompts/validation/UI) | **Adopt**                       | This is the schema-driven backbone; aligns with our existing `DocumentType.schema`.                                                                                                                       |
| **Process-as-data workflow engine** (stages/transitions/conditions as rows)                      | **Defer** (Phase 4)             | Powerful, but built for multi-reviewer back-office ops, not a lawyer analysing one case file. A simple state machine suffices for v1. When we build it: Postgres `jsonb`/join tables, not JSON-as-string. |
| **Assignment strategies / queues / round-robin / least-loaded**                                  | **Defer** (Phase 4, teams only) | Only relevant once orgs have many reviewers.                                                                                                                                                              |
| **Text-first pipeline** (`pdf-parse`/`mammoth` → text → LLM JSON)                                | **Reject as the core**          | 2nd-gen architecture; underperforms on scanned/Hindi/tables. Keep native-text parsing as the _fast path_, but the engine must be VLM-native + layout-aware (§3, §4).                                      |
| SQLite + JSON-as-string columns; in-memory `scopes` parse                                        | **Reject**                      | This repo is Postgres/Prisma — use `jsonb`/arrays/join tables from day one.                                                                                                                               |
| Dated default model IDs (`gpt-4`)                                                                | **Reject**                      | Pin current model IDs; centralize in config.                                                                                                                                                              |

**Bottom line:** keep the POC's _engineering hygiene_ patterns; replace its _extraction core_ with a VLM-native agentic engine; postpone its _workflow/assignment_ machinery until there's a multi-reviewer ICP.

---

## 2. The hard parts (unchanged from v1 — they still drive phasing)

1. **Legal hallucination is liability, not a nit** — every field carries confidence
   - provenance (page/bbox), defaults to "needs review," and **any cited law is
     verified against `@org/legal-reference`** (the AI never asserts a citation).
2. **Hindi/Devanagari OCR is make-or-break, India-first** — must be benchmarked on
   real scanned court docs in Phase 0.
3. **Conversion (uploaded→editable) is hardest** — it's Phase 3, not Phase 1.
4. **Cost & latency** — async (BullMQ), metered (`WalletUsage`), cache normalized text.
5. **PII / data residency** — private storage; documented egress; in-region option for legal clients.

---

## 3. What the industry actually expects in 2026 (research → requirements)

Findings with confidence levels; sources in §11.

- **VLM-native, layout-aware extraction is the new baseline** (confidence: high).
  3rd-gen IDP reads documents like a human — interprets layout, tables, headers,
  signatures, spatial relationships — instead of flattening to text. The 2026
  vendor-evaluation question is "VLM core vs OCR-with-AI-wrapper." → _Requirement:
  pluggable, VLM-native extraction engine; native-text parsing is only a fast path._
- **Agentic, multi-pass extraction beats single-shot** (confidence: high). Best-in-class
  pipelines segment layout → OCR/read → VLM reason → an **agentic critic re-checks
  low-confidence regions/cells** and self-corrects. → _Requirement: multi-pass
  extraction with a verification pass, especially for tables and low-confidence fields._
- **Per-field/per-cell confidence + calibration is table stakes** (confidence: high).
  Confidence must be _calibrated_ (a 0.9 is right ~90% of the time, per NIST
  trustworthy-AI guidance), and drive routing: high-confidence → straight-through;
  low → human review. → _Requirement: calibrated confidence + an eval harness that
  measures it; **STP rate** as a north-star metric._
- **HITL is a value-shift, not a fallback** (confidence: high). Humans move from data
  entry to _validation_ (reported 3–5× faster), and **corrections are training
  signal** (active learning / few-shot library). → _Requirement: review UI whose
  corrections feed the gold set and prompt examples._
- **Tables & line-items are where value and difficulty concentrate** (confidence:
  high). Most production docs are non-clean PDFs; tables hold the valuable data.
  → _Requirement: first-class table/line-item extraction, not just key-value._
- **Legal buyers differentiate on grounding, citations, audit, traceability**
  (confidence: high). Harvey/CoCounsel/Luminance/Kira/Evisort win on verified
  citations, governed processes, source-linked answers, and audit trails. →
  _Requirement: citation verification, page-cited RAG answers, full audit trail._
- **Market is large and growing** (confidence: moderate — analyst/vendor figures):
  IDP ~US$10–14B (2025–26), ~26% CAGR. Agentic approaches are now the majority of
  enterprise evaluations (a Gartner figure of ~67% is cited by vendors; treat as
  directional). → Validates investment; don't anchor on the exact numbers.
- **Indian legal reality is specific** (confidence: high — academic + practitioner
  sources): most judgments are scanned PDFs / scraped HTML with no machine-readable
  metadata; district courts/police stations are heavily **handwritten**; Devanagari
  OCR struggles with **conjuncts (संयुक्त अक्षर), the shirorekha headline, matras,
  and old fonts**. Public corpora exist to benchmark against: **HLDC** (Hindi Legal
  Documents Corpus, 1.2M+ eCourts docs), **IndianBailJudgments-1200**, **MILPaC**
  (legal-translation benchmark). → _Requirement: treat Devanagari + scanned +
  handwritten as primary, and benchmark on these public sets._

---

## 4. Target architecture (VLM-native, agentic, schema-driven, pluggable)

```
        ┌─────────── ingest ───────────┐   ┌──────── understand ────────┐   ┌─ bridge ─┐
upload → normalize → classify(doctype) → extract(schema, agentic) → analyse/RAG → convert
  │         │             │                    │            │              │         │
StorageSvc  ParserRegistry ClassifierEngine    ExtractionEngine           CitationVerify  → freeform Document
            (fast text)    (VLM/route)          (VLM multi-pass +          (@org/legal-reference)   (existing editor)
            OCR/VLM engine                      critic + confidence +
            (scanned/Hindi)                     provenance)
```

**Engine abstraction (the reusable core).** Every engine here follows
`docs/ARCHITECTURE_PRINCIPLES.md` — interface → registry → factory → config-driven
selection with capability negotiation + ordered, **observable** fallbacks (no
silent downgrade; accuracy-critical steps like citation verification are
`allowDowngrade: false`). Three pluggable interfaces, each a registry+factory
(the POC pattern, kept):

- `IParser` — native text (PDF text layer, DOCX via mammoth) — the cheap fast path.
- `IOcrEngine` / `IVisionExtractor` — for scanned/Hindi/handwritten and layout —
  candidates: vision-LLM (Gemini/Claude), Google Document AI, agentic services
  (Reducto/LlamaParse-style), self-hosted (Tesseract+Indic, Surya, docTR). Chosen
  by benchmark in Phase 0; swappable later without touching call sites.
- `IExtractionEngine` — single-shot vs **agentic multi-pass** (segment → read →
  extract → critic re-verify low-confidence/tables) → structured JSON with
  per-field confidence + provenance.

**AI provider interface — additive extension** (existing `generate`/`stream`
untouched):

```ts
interface AiProvider {
  // existing: generate, stream
  supportsVision?(): boolean;
  extract?<T>(
    input: MultimodalInput,
    schema: JsonSchema,
    opts?,
  ): Promise<Structured<T>>;
  embed?(texts: string[]): Promise<number[][]>; // RAG
}
```

`AiService` selects a capable provider per step (cheap model to classify, strong
VLM to extract — the POC's per-step model selection, kept). Whitelist
`provider:model`, fail fast.

**New surfaces (separate):**

- API: `apps/api/src/app/intelligence/` (controller, service, BullMQ queue + processors, reconciler cron).
- Lib: `libs/doc-intelligence/` (`@org/doc-intelligence`) — schemas, prompt builders, engines, normalizers, types, the **eval harness** (§6). Pure/testable, no React.
- App: `apps/app/src/app/features/intelligence/` — upload, job status, **review UI**, analysis/RAG views. Own routes (`/analyze`, `/sources/:id`).
- DB: new Postgres models (§5).

---

## 5. Customization surface (the "customisable" ask)

Customization is config-as-data (the POC's strength, scoped to what users need):

1. **Schema/template authoring (no-code)** — users/admins define an
   `ExtractionSchema`: fields (name, type, required, format, example, table vs
   scalar), per-jurisdiction variants. Prompts + validation + review UI are
   **generated from it** (config-from-DB → prompts-from-config). This is the
   reverse of `DocumentType`.
2. **Document-type taxonomy + routing** — define doc types and which schema each
   maps to; the classifier routes uploads automatically.
3. **Per-step model + threshold config** — choose classify vs extract models;
   set confidence thresholds and `reviewMandatory` per schema/field.
4. **Review routing rules** — start simple (threshold → review queue); the full
   stage/transition/assignment engine is available later (Phase 4) for orgs.
5. **Org/jurisdiction packs** — bundle schemas + prompts + legal-reference presets
   per practice area (rent, court orders, contracts), shippable as units.

Everything is `jsonb`/join-table in Postgres (no JSON-as-string), versioned, and
editable without code changes.

---

## 6. Evaluation & confidence harness (the POC's missing crown jewel)

This is what makes a legal extraction product trustworthy; build it in Phase 1, not later.

- **Gold fixture sets** — anonymized real docs (incl. Hindi, scanned, handwritten;
  seed from HLDC/IndianBailJudgments where licensing allows) with labeled fields.
- **Metrics per field/schema** — precision/recall/F1, exact vs fuzzy match, table-cell
  accuracy, and **STP rate** (share auto-approved at the confidence threshold).
- **Calibration** — reliability curves; tune thresholds so reported confidence
  matches observed accuracy (NIST guidance).
- **Regression gating** — engine/prompt/model changes must not regress the gold set.
- **Active learning** — reviewer corrections flow back into the gold set and the
  few-shot example library, improving accuracy over time.

---

## 7. Phased roadmap (re-ordered: extraction quality + eval first; ops later)

Rough effort (1 eng); measurable exits.

- **Phase 0 — Foundations & OCR/engine spike (~1.5 wk).** Benchmark OCR/extraction
  paths on **real Hindi + scanned court docs** (vision-LLM vs Document AI vs
  self-hosted). Extend `AiProvider` (vision + structured + embed). `intelligence`
  module skeleton, BullMQ queue, `SourceDocument`, presigned upload.
  **Exit:** 5-page scanned Hindi PDF → normalized per-page text/layout with a
  _recorded character-accuracy number_; go/no-go on engine.
- **Phase 1 — Extraction MVP + eval harness (~3 wk).** `ExtractionSchema` (no-code
  authoring), agentic multi-pass extraction → JSON with **per-field confidence +
  provenance**, classification→schema routing, **review UI** (doc + fields +
  click-to-highlight + accept/correct), the **eval harness (§6)**, `WalletUsage`
  metering. **Exit:** upload → auto-classify → extract → review/correct →
  download; precision/recall + STP tracked on the gold set.
- **Phase 2 — Analysis, citations & Q&A (~2–3 wk).** Summary, timeline,
  obligations/parties, clause/risk flags; **citation extraction + verification via
  `@org/legal-reference`**; RAG "ask this document" with **page-cited** answers.
  **Exit:** case-file summary + cited-law health; answer a question with a correct
  page citation.
- **Phase 3 — Convert → editable document (the bridge) (~3–4 wk).** Normalized doc
  → clean `freeform` HTML (tables/lists/headings/Hindi) + optional `{{placeholder}}`
  injection from Phase-1 fields; "Open in editor" creates a `freeform` `Document`.
  **Exit:** uploaded contract → editable, paginating doc that round-trips the editor
  and re-exports (defined fidelity rubric; not pixel-perfect).
- **Phase 4 — Teams/ops & advanced (later, only if multi-reviewer ICP).** _Now_
  port the POC's process-as-data workflow engine (Postgres-native), assignment
  strategies, queues, exception lifecycle, bulk review. Plus: multi-document
  **matter/case workspace**, document comparison/diff, batch extraction,
  redaction/PII tooling, webhooks/integration API.

---

## 8. India-first & legal specifics (don't treat as edge cases)

- **Devanagari OCR**: handle conjuncts, shirorekha, matras, old/typewriter fonts,
  mixed Hindi-English; budget for **handwriting** at district-court level.
- **Source reality**: eCourts PDFs/scraped HTML with no machine-readable metadata;
  stamps/seals; multi-language.
- **Benchmark** against HLDC / IndianBailJudgments-1200 / MILPaC.
- **Citations**: verify against `@org/legal-reference`; flag repealed IPC/CrPC/
  Evidence Act references — a concrete legal differentiator.
- **Data residency**: offer in-region/on-prem extraction for clients who require it.

---

## 9. Open decisions (needed before Phase 0 build)

1. **OCR/extraction engine** — vision-LLM vs Google Document AI vs self-hosted
   (Tesseract+Indic / Surya / docTR) vs hosted agentic (Reducto/LlamaParse).
   Trade-off: Hindi/scanned accuracy vs cost vs **data residency**. _Recommend
   benchmarking vision-LLM + Document AI + one self-hosted on real samples first._
2. **First formats** — native-text PDF/DOCX first (easy, high value) or commit to
   scanned-Hindi from day one (harder, the differentiator)?
3. **Data residency** — must OCR/LLM stay in-region/on-prem? Constrains (1).
4. **ICP** — single-lawyer/case analysis first (defer workflow engine) vs
   multi-reviewer firms early (promote Phase 4)?
5. **Conversion fidelity bar** — clean semantic HTML vs visual fidelity? Sets Phase 3.

---

## 10. Separation contract

New module (`intelligence`), new lib (`@org/doc-intelligence`), new Postgres
models. **No edits to `Document`/`DocumentVersion`/editor.** Read-only reuse:
`StorageService`, `AiService` (extended additively), `@org/legal-reference`,
`@org/ui`, BullMQ, `WalletUsage`. The _only_ write-bridge is Phase 3 `convert`,
which calls the existing document-create path to spawn a `freeform` `Document`.

```
upload → normalize → [classify → extract | analyse | ask] → (P3) convert ──┐
   SourceDocument / IntelligenceJob / Extraction / AnalysisRun (separate)   │
                                                                            ▼
                                              creates freeform Document → existing editor
```

---

## 11. Sources (industry research, 2025–2026)

- Everest Group, _IDP State of the Market 2025_ — https://www.everestgrp.com/report/egr-2025-38-r-7283/
- Fortune Business Insights, _IDP Market Size_ — https://www.fortunebusinessinsights.com/intelligent-document-processing-market-108590
- Docsumo, _50 IDP Statistics & Trends 2025_ — https://www.docsumo.com/blogs/intelligent-document-processing/intelligent-document-processing-market-report-2025
- _IDP 2026 Enterprise Guide_ (VLM-native generations) — https://koreadeep.com/en/blog/intelligent-document-processing-2026-guide
- LlamaIndex, _Agentic Document Extraction_ — https://www.llamaindex.ai/blog/agentic-document-extraction
- LandingAI, _Confidence Scores_ — https://landing.ai/blog/introducing-confidence-scores-surface-parsing-uncertainty-before-it-becomes-a-problem
- Extend, _Best Confidence Scoring Systems_ — https://www.extend.ai/resources/best-confidence-scoring-systems-document-processing
- Reducto, _Document Parser Comparison_ — https://llms.reducto.ai/document-parser-comparison · _vs Google Document AI_ — https://llms.reducto.ai/reducto-vs-google-document-ai
- Google Cloud, _Document AI_ — https://cloud.google.com/document-ai
- GC AI, _AI Contract Review 2026_ — https://gc.ai/blog/ai-contract-review · Legal AI guide — https://www.buildmvpfast.com/articles/best-llms-2026-guide/legal-ai
- _HLDC: Hindi Legal Documents Corpus_ — https://arxiv.org/html/2204.00806v2
- _IndianBailJudgments-1200_ — https://arxiv.org/html/2507.02506v1
- _MILPaC_ (legal translation benchmark, Indian languages) — https://arxiv.org/pdf/2310.09765
- _Handwritten legal document translation with OCR + VLMs_ — https://arxiv.org/pdf/2512.18004
- _OCR for Legal Documents in India_ — https://juniorlawyer.in/blog/ocr-true-typing-legal-documents-india/

```

```
