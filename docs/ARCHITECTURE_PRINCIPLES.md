# Architecture Principles — pluggable, swappable, configurable services

**Status:** standing reference · **Applies to:** all new integrations · **Updated:** 2026-06-09

> **The rule:** every external capability and every "we might use a different
> provider one day" seam is accessed **through an interface**, resolved through a
> **registry + factory**, selected by **config (not hardcoding)**, with an
> **ordered fallback chain**, **capability negotiation**, and **telemetry that
> records which implementation actually served each call**. You can switch
> providers, add a new one, or reorder fallbacks **without touching call sites**.

This already exists in the codebase for LLMs (`AiProvider` + `AiService`) and
storage (`StorageService`). New work (Document Intelligence engines, OCR,
payment gateways, mail, etc.) must follow the same shape. The Document
Intelligence roadmap (`docs/05-document-intelligence-roadmap.md`) is built on
this doc — refer back here.

---

## 1. When to apply it — and when NOT

Apply it to **seams**:

- An **external dependency** you might swap or that might fail (LLM providers,
  OCR/extraction engines, object storage, payment gateways, email/SMS, search).
- Anything with **≥2 realistic implementations** now or clearly soon.
- Anything you want **operators to switch by config**, not redeploy.

Do **NOT** apply it to:

- Pure internal logic with **one** implementation and no swap on the horizon —
  wrapping that in an interface is ceremony that slows everyone down.
- One-off helpers. (You can extract an interface later when the _second_
  implementation actually appears — that refactor is cheap; premature
  abstraction is not.)

> Honest caveat: "interface everything" is an anti-pattern as real as
> "hardcode everything." Interface the seams; keep the core direct.

---

## 2. The shape: Interface → Registry → Factory → Selector → Telemetry

1. **Interface** (`IThing`) — the capability contract. Narrow, behavior-only,
   no provider details leaking through. Optional methods + a `supports*()`
   capability probe for features not all implementations have.
2. **Implementations** — one class per provider (`OpenAiProvider`,
   `GeminiProvider`, `DocumentAiOcr`, `TesseractOcr`, …). Self-contained.
3. **Registry** — discovers/holds implementations; resolves the right one for an
   input (e.g. parser by mime-type) or by key. Adding a provider = register one
   class; call sites unchanged.
4. **Factory** — builds/caches instances (often keyed, e.g. `"provider:model"`),
   so repeated use doesn't re-instantiate. (Mirrors the POC's cached
   `AiProviderFactory`.)
5. **Selector** — picks _which_ implementation for _this_ call: **config →
   capability filter → health/availability → ordered fallback**. Never "first
   one wins" by accident.
6. **Telemetry/audit** — record which implementation+model served, latency,
   tokens/cost, and whether a fallback fired. Meter cost (`WalletUsage`).

---

## 3. Selection & fallback policy (read this twice — it's where legal risk hides)

- **Config-driven, per task/step.** Selection comes from config (DB or env), not
  literals. A pipeline step names a _task_ (e.g. `extract.table`), and config
  maps the task → an ordered list of `provider:model` candidates + thresholds.
  (The POC's per-step model selection — classify cheap, extract strong — is the
  right pattern.)
- **Capability negotiation, not just availability.** The selector filters
  candidates by `supports*()` (vision? structured output? embeddings?) before
  health — a provider that's _up_ but can't do vision is not a candidate for a
  vision task.
- **Ordered fallback for discrete calls.** On a transient/availability failure,
  fall to the next candidate. Fallback applies to **discrete request/response
  calls**, not mid-stream generation (don't try to resume a half-streamed answer
  on another provider — the POC correctly avoids this).
- **Fallback must be observable.** Every response records the implementation that
  actually served it; a fired fallback is logged/audited and surfaced in metrics.
  **No silent downgrade.**
- **Some steps must fail loudly, not downgrade.** Mark steps as
  `allowDowngrade: false` when a weaker provider would be unsafe — e.g.
  **citation verification, legal extraction where accuracy is load-bearing**.
  There, a fallback to a weaker model is worse than an error. Prefer surfacing
  "couldn't run with the required engine" over a quietly worse result.
- **Whitelist + fail fast.** Allowed `provider:model` combos are validated
  _before_ any paid call (the POC's `VALID_PROVIDER_MODELS`). Reject unknown
  combos at config-load.
- **Resilience primitives** per call: timeout, bounded retry with backoff, and a
  **circuit breaker** so a flapping provider is skipped instead of retried into
  the ground.

---

## 4. Configuration model

- **Config-as-data.** Provider/model/threshold/fallback-order live in config that
  operators can change without a deploy: env for infra-level (which providers are
  enabled, keys), DB (`jsonb`/join tables — **never JSON-as-string**) for
  product-level (per-schema/step model + threshold + routing).
- **Sane defaults + explicit override.** Ship working defaults; allow per-org /
  per-task override.
- **Pin current model IDs centrally.** No dated literals scattered in services
  (the POC's stale `gpt-4` default is the anti-example).

---

## 5. Current & planned seams in this repo

| Seam                            | Interface                                   | Implementations                                                                 | Selection                                                                                                                                |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| LLM text gen                    | `AiProvider` (exists)                       | Claude, Gemini, OpenAI                                                          | **Upgrade needed:** today `AiService` picks "first available"; move to config → capability → health → fallback, and record which served. |
| LLM multimodal/structured/embed | `AiProvider` (extend)                       | vision-capable providers                                                        | capability-gated (`supportsVision`/`extract`/`embed`)                                                                                    |
| Object storage                  | `StorageService` (exists)                   | local FS, S3/presigned                                                          | env/config                                                                                                                               |
| Doc parse (fast text)           | `IParser` (planned)                         | PDF text, DOCX (mammoth)                                                        | registry by mime-type                                                                                                                    |
| OCR / vision extract            | `IOcrEngine` / `IVisionExtractor` (planned) | vision-LLM, Google Document AI, Tesseract+Indic / Surya / docTR, hosted agentic | config + capability + fallback; **benchmark-chosen**                                                                                     |
| Structured extraction           | `IExtractionEngine` (planned)               | single-shot, agentic multi-pass                                                 | config per schema                                                                                                                        |
| Payments                        | (gateway abstraction)                       | per `PaymentGateway` enum                                                       | config                                                                                                                                   |
| Mail                            | mail service                                | provider(s)                                                                     | config                                                                                                                                   |

---

## 6. Checklist for adding any new external service

- [ ] Define/locate the **interface**; add `supports*()` for non-universal features.
- [ ] Implement the provider; **register** it (no call-site edits).
- [ ] Add it to the **whitelist/config**; pin model IDs; set sane defaults.
- [ ] Place it in the **fallback order**; decide `allowDowngrade` per task.
- [ ] Wire **timeout / retry / circuit-breaker**.
- [ ] Emit **telemetry** (which impl served, latency, cost → `WalletUsage`); audit fallbacks.
- [ ] Negotiate **capabilities** in the selector (don't route a task to an impl that can't do it).
- [ ] Test: swap the impl via config only, and force a fallback, in tests.

---

## 7. Anti-patterns (call these out in review)

- `new OpenAIClient()` (or any provider) **inside a service** instead of behind the factory.
- `if (provider === 'openai') … else if …` branching at call sites — that's what the registry is for.
- **Silent fallback** that hides a downgrade — especially on accuracy-critical legal steps.
- Provider details (model strings, vendor SDK types) **leaking through the interface**.
- Config baked into code literals; JSON-as-string columns; dated model IDs.
- Interface-wrapping a single-implementation internal module "just in case."
