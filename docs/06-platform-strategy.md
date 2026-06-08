# Platform Strategy — AI-native document lifecycle, India-first (focused, not bloated)

**Status:** strategy · **Updated:** 2026-06-09 · **Builds on:**
`01-market-analysis-india.md` (market + regulatory), `02-product-roadmap.md`
(build phases), `05-document-intelligence-roadmap.md` (understand/extract),
`ARCHITECTURE_PRINCIPLES.md` (pluggable services).

This doc answers two questions: **what to build (and deliberately NOT build)** to
be a real document platform that solves actual problems, and **why now** given
who is earning well without being AI-native.

---

## 1. Read first — where the "now is the time, incumbents lack AI" thesis is wrong

Steelmanning the counter, because it changes the plan:

1. **AI is not a moat.** The models are commodities every incumbent can call. The
   well-funded ones (LegalZoom, DocuSign, Vakilsearch/Zolvit, SignDesk) are
   _already_ adding AI. "We're AI-native" wins nothing by itself.
2. **The buyers already want AI** — law-firm adoption reportedly went 19%→79% and
   corporate legal 23%→54% in a year (Confidence: moderate). So demand is proven
   _and_ the space is crowding fast. Timing is a window, not a vacuum.
3. **Incumbents have what you don't: distribution + trust + execution rails**
   (eMudhra/NSDL handle 1.8B+ e-signatures; Vakilsearch has SMB funnel). A broad
   horizontal "AI document platform" competes with all of them at once and loses.
4. **"Full-fledged platform" built upfront IS the bloat you want to avoid.** The
   graveyard is full of horizontal doc tools.

**So the real thesis (corrected):** the opportunity is **not** "AI vs no-AI." It's
that today's profitable players each own **one slice** of the document lifecycle
and none owns the **AI-native, India-first, vernacular loop** end-to-end — because
doing so is _beneath their margin model_ (services players) or _outside their
product DNA_ (template/rails players). Win a **sharp wedge** in that loop, then
expand along it. AI + India-first + legal-currentness is the _compounding_
advantage; the lifecycle loop + a corrections data flywheel is the _moat_.

---

## 2. Market map — who earns well, and where each is structurally weak

(Sizes/figures are third-party; Confidence: moderate. Sources §9.)

- India LegalTech ~**US$1.25–1.28B** by 2026/2030 (~15% CAGR); India **legal-AI**
  segment small but fast (~$29.5M 2024 → ~$106M 2030, ~23% CAGR). 800+ legaltech
  firms; 2025 funding surged. India digital-signature market ~$190M (2024) →
  ~$1.35B (2032), ~27% CAGR.

| Incumbent type                | Examples                                                                | Why they earn                                                        | AI status                          | Structural weakness (our opening)                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Template doc-gen**          | LegalZoom, Rocket Lawyer, LawDepot (global); LegalDesk/eDrafter (India) | Huge self-serve user bases (10M–30M), wizard forms                   | Bolting GenAI onto wizards         | No document **understanding**; US-centric; English-only; static templates go stale vs law changes                                        |
| **Compliance/doc _services_** | Vakilsearch/Zolvit (~₹37 Cr), IndiaFilings, LegalRaasta                 | SMB funnel; registration/filing/consultation (₹20k Cr + ₹10k Cr SAM) | Human-labor arbitrage; AI-light    | Margins depend on _people_; can't go AI-native without cannibalizing the services revenue — they **won't** chase a self-serve AI product |
| **E-sign / e-stamp rails**    | eMudhra (~35% e-Sign), NSDL/Protean, Leegality, Digio, SignDesk         | Transaction volume (1.8B+ e-sigs/yr), gov integrations               | Signing/KYC AI, some CLM           | They _move/sign_ docs; they don't **draft or understand** them. Integrate them, don't fight them                                         |
| **Legal research/DB**         | Manupatra, SCC Online, LexisNexis/Westlaw India, CaseMine               | Subscriptions, case law                                              | CaseMine AI-forward; others slower | Research ≠ drafting/execution; not a creation surface                                                                                    |

**Read across the row:** the services players are the ones "earning well without
AI" most exposed — their moat is _labor_, and an AI-native self-serve product is
exactly what they can't ship without eating their own margin. That's the cleanest
disruption target. The rails players are **partners** (execution), not targets.

---

## 3. The actual problems (jobs-to-be-done) — solve these, ignore the rest

Target user (wedge): **small/solo Indian advocates and SMBs** — underserved by
template players (English/US) and overcharged by services players.

1. _"Draft a correct document fast, in my language, that won't embarrass me in
   court."_ — routine drafts (notices, agreements, petitions) in Hindi/vernacular,
   **current** on law (the new criminal codes BNS/BNSS/BSA are a live accuracy
   landmine — see `01` §4.4; static templates are silently wrong).
2. _"Understand this document someone sent me."_ — extract parties/dates/
   obligations/cited law from an uploaded PDF (often scanned/Hindi). (→ `05`.)
3. _"Turn what I received into something I can edit and send back."_ — convert an
   uploaded doc into an editable, re-fillable draft. (→ `05` Phase 3 bridge.)
4. _"Get it signed and stamped legally."_ — e-sign + e-stamp via existing rails,
   not a re-built signature stack.
5. _"Don't make me re-key the same client/matter data every time."_ — reuse across
   the loop.

If a proposed feature doesn't serve one of these five for this user, it's a
candidate for the cut list (§5).

---

## 4. The product: one loop, not a feature pile

```
        ┌──────────────────────────────────────────────┐
        │   DRAFT  ⇄  UNDERSTAND  ⇄  VERIFY  ⇄  EXECUTE   │   ← the loop is the product
        └──────────────────────────────────────────────┘
 Draft/Revise (AI copilot, vernacular)   ── already core (apps/app editor)
 Understand (extract/analyse uploads)    ── docs/05 (separate module, bridges in)
 Verify (citations/compliance current)   ── @org/legal-reference (the trust layer)
 Execute (e-sign / e-stamp)              ── integrate eMudhra/NSDL/Leegality (don't rebuild)
```

The differentiator is the **loop closing**: a doc you receive can be understood →
turned into an editable draft → verified against current law → signed/stamped →
stored, all AI-native and in-language. No incumbent does the whole loop; each does
one arc. The **corrections** users make (drafting edits, extraction fixes) are the
**data flywheel** — proprietary, India-legal, improves accuracy, and is the thing a
generic GPT wrapper or a US template player can't replicate.

---

## 5. The cut list — what we deliberately do NOT build (this is half the strategy)

To stay "full-fledged but not overloaded," these are **explicit non-goals** until
the loop is proven and pulling revenue:

- ❌ Our own e-signature/e-stamp/PKI stack — **integrate** eMudhra/NSDL/SHCIL/Aadhaar
  eSign. Rebuilding regulated rails is a multi-year tar pit.
- ❌ A heavy DB-driven workflow/assignment engine, queues, round-robin (the POC's
  crown jewel) — **only** if/when multi-reviewer firms become the ICP (`05` Phase 4).
- ❌ Legal-research/case-law database — that's Manupatra/SCC/CaseMine's game; we
  _consume_ citations via `@org/legal-reference`, we don't become a research DB.
- ❌ Practice management / billing / CRM — adjacent, not the loop. Integrate later.
- ❌ A marketplace of lawyers — that's the services players' model; it pulls us into
  labor margins we're trying to disrupt.
- ❌ Generic "AI chat with any document" with no legal grounding — undifferentiated
  and a trust hazard for legal use.
- ❌ Multi-country/US expansion early — India-first is the _advantage_; diluting it
  is how we become a worse LegalZoom.

Every "no" here is a "yes" to depth on the five JTBD.

---

## 6. Positioning vs each incumbent

- **vs template players (LegalZoom/Rocket Lawyer/LawDepot/LegalDesk):** "templates
  don't _read_ your documents and go stale on the law; we draft _and_ understand,
  in your language, current on BNS/BNSS/BSA."
- **vs services players (Vakilsearch/IndiaFilings/LegalRaasta):** "what you pay a
  team days for, self-serve in minutes — at services-margin-free pricing." (They
  structurally won't follow without cannibalizing.)
- **vs rails (eMudhra/Leegality/Digio):** "not a competitor — we're the create +
  understand layer that feeds your sign/stamp rails." → integration/partnership.

---

## 7. Sequencing (wedge → loop), reconciled with the roadmaps

1. **Wedge:** best-in-class **AI drafting copilot, vernacular, law-current** for the
   solo-advocate/SMB long tail (`02` Phase A/B). One job, 10× better. Win retention here.
2. **Close the inbound arc:** **Understand uploads → convert to editable draft**
   (`05` Phases 1–3 bridge). Now the loop has both directions.
3. **Execute:** integrate e-sign/e-stamp rails (`02` Phase D) — partner, don't build.
4. **Trust layer throughout:** `@org/legal-reference` currency + citation
   verification = the defensible "won't embarrass you in court."
5. **Expand only along the loop**, gated on usage — never feature-out into §5's cut list.

North-star metrics: time-to-correct-draft, draft-acceptance rate, extraction STP
(`05` §6), loop-completion rate (received→edited→executed), and correction volume
(the flywheel). Avoid vanity feature counts.

---

## 8. Risks (carried from `01` §0 + new)

- **Incumbents add AI faster than we add distribution** (high). Mitigation: wedge +
  vernacular + legal-currentness depth they won't match quickly; data flywheel.
- **Legal accuracy liability** (high). Mitigation: AI never authors citations;
  verify via `@org/legal-reference`; HITL + provenance (`05`).
- **Execution-rail dependency** (medium). Mitigation: pluggable rail integrations
  (`ARCHITECTURE_PRINCIPLES.md`), multi-vendor.
- **Scope creep back into the cut list** (high, internal). Mitigation: this doc;
  re-justify any §5 item before building.
- **Trust/distribution cold-start** (high). Mitigation: solo-advocate wedge,
  vernacular, freemium drafting; partnerships with rails/bar associations.

---

## 9. Sources (Confidence: moderate — third-party/analyst/vendor)

- India Legal Technology Market — https://www.grandviewresearch.com/horizon/outlook/legal-technology-market/india
- India Legal AI Market — https://www.grandviewresearch.com/horizon/outlook/legal-ai-market/india
- LegalTech India market commentary — https://legistify.com/blogs/legaltech-india/
- IndiaFilings / LegalRaasta profiles — https://www.owler.com/company/indiafilings · https://www.owler.com/company/legalraasta
- India legal-tech innovators — https://blog.privatecircle.co/legal-tech-startups-india-watch/
- LegalZoom vs Rocket Lawyer (user bases) — https://www.llcuniversity.com/rocket-lawyer-vs-legalzoom/
- Law-firm/corporate AI adoption (ABA Legal Industry Report 2025) — https://www.americanbar.org/groups/law_practice/resources/law-technology-today/2025/the-legal-industry-report-2025/
- India digital-signature market — https://www.6wresearch.com/industry-report/india-digital-signature-market · https://www.grandviewresearch.com/horizon/outlook/digital-signature-market/india
- eMudhra / e-Sign volume & share — https://www.fortunebusinessinsights.com/industry-reports/digital-signature-market-100356

> Note: company revenue/profit figures are sparse and third-party; treat as
> directional. Validate against primary filings (LegalZoom 10-K, eMudhra filings,
> MCA filings for Indian pvt cos) before using in a deck or board doc.
