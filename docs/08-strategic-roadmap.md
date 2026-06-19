# 08 — Strategic Roadmap & Market Review (2026-06-12)

> **Author's stance.** This document is deliberately blunt. It supersedes the phase
> ordering in [`02-product-roadmap.md`](02-product-roadmap.md) where they conflict — not the
> product vision, just the *sequence*. It is written against one hard fact established by
> [`BUILD_LOG.md`](BUILD_LOG.md) and the memory tracker: **as of today, ~95% of the platform is
> code-complete and runtime-unverified.** Every recommendation flows from that.

---

## 0. Executive summary (read this if nothing else)

1. **The bottleneck is not features. It is verification + zero users.** You have built a
   coherent specification expressed as code. You have never watched a real user complete a
   flow in a browser. Building more breadth before proving the base converts your one asset
   (a clean codebase) into unverified maintenance surface.
2. **The market is real but small, crowded, and hard to monetize.** India legal-AI is
   **$29.5M (2024) → $106.3M (2030), 23% CAGR** — but that is **2.0% of the global legal-AI
   market**, the sector now has **960 companies**, and the funded leader (SpotDraft) is burning
   **~₹1 of loss per ₹1 of revenue.** Your own honest ceiling — **₹15–80 Cr top-line over 3
   years** — is, if anything, optimistic for a tiny team. The strategic response is **ruthless
   narrowness**, not a platform.
3. **Your real moat is currentness (BNS/BNSS/BSA), and it is currently made of paper.** The AI
   is *instructed* not to author repealed citations; nothing *validates* that it didn't.
   Server-side citation validation is the single most important feature you have not built.
4. **Sequence: VERIFY → one wedge to revenue → 10 paying users → expand on evidence.** All
   three wedges (rent / notice+§138 / doc-intelligence) remain in scope per product decision,
   but pursued **in sequence, not in parallel** (see §4 for why parallel is a mistake).

---

## 1. Market analysis (independently verified 2026-06-12)

| Claim | `01-market-analysis` said | Verified reality | Confidence |
|---|---|---|---|
| India legal-AI market | $29.5M→$106.3M, 23% CAGR | **Confirmed** (Grand View). India = **2.0% of global** legal-AI. | Moderate |
| India legal-tech ecosystem | 662 companies, $793M cumulative | **Now 960 companies**, 86 funded, ~$793M cumulative, **+781% YoY funding in 2025** | High |
| SpotDraft | ~$80M raised, $54M Series B | **>$113M** ($54M Series B Feb-2025 + $8M Qualcomm ext. early-2026); **FY25 rev ₹121 Cr, loss ₹121 Cr** | High |
| Vakilsearch | "Vakilsearch" | **Rebranded to Zolvit** | High |
| AI-drafting competitors | implied open | **BharatLaw.ai** + SEO "top-10 tools" content layer already exist | Moderate |

**Interpretation:**
- The crowd grew (662→960) while you were building. You are **not** early to "AI + Indian law."
- SpotDraft's 1:1 burn is the real signal: **monetization in Indian legal-tech is brutal even
  for the funded leader.** Plan for slow, painful revenue, not a hockey stick.
- Implication: **own one search term and one document better than anyone in India.** Do not
  build a platform competing on breadth with 960 companies. (Confidence: **high.**)

**Regulatory landmine (unchanged, still the #1 correctness risk):** new criminal codes
effective **1 July 2024** — IPC→**BNS**, CrPC→**BNSS**, Evidence Act→**BSA**. Any LLM trained on
pre-2024 text will hallucinate repealed sections. This is simultaneously your biggest liability
**and** your biggest differentiator. See §5, feature #1.

---

> **🔄 STATUS CORRECTION (2026-06-19).** Several *factual premises* below have since changed —
> corrected here; the strategic *argument* is unchanged (and, if anything, reinforced):
> - **Citation validation is now BUILT** (Tier 1 done): server-side validator + `CitationFillerService`
>   wired into generate/revise. ✅ The "single most important unbuilt feature" of §0.3 / §5 is shipped.
>   **BUT** it is still *runtime-unverified* — no browser proof it catches a planted repealed-code ref.
> - **Schedule-1 eSign hard-gate is now BUILT** (Tier 1 done). The §2 risk #4 is closed.
> - **There are now 18 structured `DocumentTypeBundle`s, not 4** — incl. three court bundles (§138,
>   consumer complaint, anticipatory bail) that were previously freeform AI presets (closing §2 risk #2
>   for those three). The table below is historical.
> - **What has NOT changed: verification debt is still the whole story** (§0.1, §2 risk #1). We added
>   3 more bundles this session, every one marked "NOT runtime-verified." The Phase 0 browser walk +
>   `VERIFICATION_LOG.md` remains the unmet exit gate that should precede any further breadth.

## 2. Code reality (audited, not assumed)

**Better than the docs claim** *(historical — as of 2026-06-12; see the correction banner above — there
are now 18 bundles)*: there were then **4 real `DocumentTypeBundle`s**, not one — each with full
`schema + form-metadata + prompts + risks` *and* a registered template:

| Doc type | Bundle LOC | Template | Status |
|---|---|---|---|
| `rent-agreement` | 711 | `classic` | Real, deepest |
| `legal-notice` | 472 | `formal` | Real |
| `rti` | 373 | `default` | Real |
| `affidavit` | 330 | `default` | Real |

This **validates the core architectural bet at the code level**: the bundle abstraction scales
to new doc types without ad-hoc hacks. Keep enforcing it at PR review. *(Confirmed at scale since:
18 bundles, no ad-hoc hacks outside the bundle pattern.)*

**The real risks (status as of 2026-06-19):**
1. **Verification debt is the whole story** *(STILL OPEN, confidence: high)* — "tsc 0 / build ✓" ≠
   "works." First real run will surface 5–15 bugs. 18 bundles now, none browser-verified.
2. **Court docs are AI presets, not bundles** *(PARTLY CLOSED)* — §138, consumer complaint, and
   anticipatory bail are now structured bundles with deterministic risk rules. The remaining
   freeform court presets (plaint, written statement, vakalatnama, writ) still emit freeform HTML.
3. ~~**Citation correctness asserted, not enforced**~~ *(CLOSED in code — validator + filler wired;
   runtime proof still pending)*.
4. ~~**Schedule-1 eSign hard-gate still open**~~ *(CLOSED — hard-gate by doc type shipped)*.

---

## 3. The roadmap (inverted around the real constraint)

Dates from **2026-06-12**. Weeks are effort estimates for a small team.

### Phase 0 — PROVE IT (weeks 1–2) — *blocks all new feature work*
- Stand up app + API + Postgres + Redis + real Anthropic key (`run` / `verify` skills).
- Browser-walk the **rent-agreement** flow end-to-end: create → fill → risks → PDF → share →
  public view. Fix breakage.
- Browser-walk the **document-intelligence** flow once: upload PDF → classify → extract →
  review → approve → editable doc (most complex, least verified).
- **Deliverable:** `VERIFICATION_LOG.md` listing every path exercised + every bug found.
- **Exit gate:** both happy-paths green in a browser. No new feature starts until this passes.

### Phase 1 — WEDGE #1 + CORRECTNESS MOAT (weeks 2–6) — *rent agreement*
- **Server-side citation validation** (`ICitationValidator` via the registry pattern): reject /
  flag any AI output containing a repealed code reference. `allowDowngrade: false`. **This is
  the moat. Build it first.**
- **Schedule-1 hard-gate** by doc type (legal safety, free).
- **DOCX export** (Phase B from `02-`): editable Word is non-negotiable for the B2B side.
- Payments live for one tier; the funnel must actually charge ₹49–₹199.
- **Exit gate:** rent-agreement is publicly shippable and charges money.

### Phase 2 — FIRST 10 PAYING USERS (weeks 6–10)
- Ship rent-agreement publicly. SEO the one term. Instrument everything.
- **Hard rule: do not start Wedge #2 until 10 strangers have paid for Wedge #1.**

### Phase 3 — WEDGE #2: LEGAL NOTICE / §138 (weeks 10–16)
- Promote §138 notice + consumer complaint from freeform presets to real `DocumentTypeBundle`s
  (reuses the proven pattern). Per-state risk libraries.
- Higher ARPU (₹499–1,499), advocate stickiness. Riskier — gated behind the citation validator
  from Phase 1.

### Phase 4 — WEDGE #3: DOCUMENT INTELLIGENCE, MONETIZED (weeks 16+)
- Only now harden Phases 0–3 of [`05-`](05-document-intelligence-roadmap.md) into a paid
  feature, **with a clear answer to "who pays and why."** It is your most novel but least
  proven, hardest-to-explain capability — last, not first.
- eSign (Digio), Hindi UI QA, org multi-tenancy, marketplace — pulled in the order *paying
  users* demand them, not the order `02-` guessed.

### Explicitly FROZEN until there are paying users (confidence: high these are premature)
Template marketplace · white-label subdomains · PWA/offline · per-org configurable pipelines
(docs/07 P4.2+) · multi-provider OCR benchmarking · any 5th–Nth doc type beyond the 4 built.

---

## 4. Why "all 3 wedges in parallel" is the wrong call

Product decision was "all 3 wedges." They remain in scope — **sequenced** (Phases 1→3→4).
Pursuing them in parallel fails because:
- A tiny team splitting across 3 surfaces verifies none of them to revenue.
- The 3 wedges have *different buyers* (consumer / advocate / ops), *different price points*,
  and *different legal-risk profiles*. Marketing and trust-building cannot be shared.
- Doc-intelligence is the least-proven and hardest to sell; front-loading it burns runway on
  the riskiest bet first.
- SpotDraft's 1:1 burn proves there is no slack in this market to fund three half-built fronts.

If new evidence emerges (e.g. a paying customer pulls notice + intelligence together), revisit.
Absent that, **sequence stands.** (Confidence: **high.**)

---

## 5. New features worth building — with architecture mapping

In priority order. All fit existing seams; none are new verticals.

1. **Citation-validation service** — `ICitationValidator` behind Interface→Registry→Factory;
   deterministic lookup vs `@org/legal-reference`; post-generation gate, `allowDowngrade:false`.
   *This feature **is** the moat.* **Build first (Phase 1).**
2. **"Currentness" as product** — visible "✅ Updated for BNS/BNSS/BSA (1 Jul 2024)" badge + a
   diff tool ("CrPC §200 → BNSS §223"). No dated-UI incumbent matches this quickly. Eng + marketing.
3. **Structured court-doc bundles** — promote top-3 presets (§138 notice, consumer complaint,
   anticipatory bail) to real `DocumentTypeBundle`s with `risks.ts` + state libraries (Phase 3).
4. **AI accept/reject diff UI** for `/legal-ai/revise` — endpoint exists, no diff UI. Cheap,
   high trust impact.
5. **eStamp + eSign execution flow** (Phase 4) — draft→stamp→sign→done is the real
   differentiator vs commodity template sites; needs paid providers + Schedule-1 gate first.

---

## 6. Success metrics (replace vanity metrics)

- **Phase 0:** 2 happy-paths green in browser; bug count found (higher = more honest).
- **Phase 1:** first ₹ charged; citation validator catches ≥1 planted repealed-code reference.
- **Phase 2:** **10 paying users.** This is the only metric that matters before expansion.
- **Phase 3+:** revenue per wedge, not feature count.

---

## 7. One-paragraph thesis

You have over-built and under-verified. The market rewards being the single best Indian tool
for one document with bulletproof, current citations — not a 960th platform. Verify what you
have, weaponize currentness into a real (validated, not asserted) moat, ship one wedge to ten
paying strangers, and let their money — not this document — write the rest of the roadmap.
