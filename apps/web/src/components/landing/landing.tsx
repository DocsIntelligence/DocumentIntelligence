import Link from 'next/link';
import { appHref } from '../../lib/app-href';
import { SITE_NAME } from '../../lib/site';
import { Icon, type IconName } from './icons';
import { Reveal } from '../site/reveal';

/* ── Content ─────────────────────────────────────────────────────────── */

const DOCUMENT_TYPES: {
  icon: IconName;
  tag: string;
  title: string;
  desc: string;
}[] = [
  {
    icon: 'document',
    tag: 'Personal',
    title: 'Rent agreement',
    desc: 'State-specific clauses and stamp-duty guidance, built for your city.',
  },
  {
    icon: 'notice',
    tag: 'Legal',
    title: 'Legal notice',
    desc: 'Cheque-bounce, recovery and breach notices — NI Act §138 aware.',
  },
  {
    icon: 'scroll',
    tag: 'Personal',
    title: 'Will',
    desc: 'Execution-ready, with witness blocks and clear asset schedules.',
  },
  {
    icon: 'key',
    tag: 'Legal',
    title: 'Power of attorney',
    desc: 'General and special POA drafts, ready for notarization.',
  },
  {
    icon: 'shield',
    tag: 'Business',
    title: 'NDA',
    desc: 'Mutual or one-way, with founder- and enterprise-grade clauses.',
  },
  {
    icon: 'gavel',
    tag: 'Legal',
    title: 'Affidavit',
    desc: 'Court and non-court formats, matched to your state.',
  },
  {
    icon: 'users',
    tag: 'Civic',
    title: 'RTI application',
    desc: 'Right to Information Act applications, PIO-ready.',
  },
  {
    icon: 'layers',
    tag: 'Legal',
    title: 'Consumer complaint',
    desc: 'Filings under the Consumer Protection Act, forum-ready.',
  },
  {
    icon: 'briefcase',
    tag: 'Business',
    title: 'Employment offer',
    desc: 'Offer letters with compensation, notice period and clauses.',
  },
];

const STEPS = [
  {
    title: 'Pick a document type',
    desc: 'Choose from 19+ Indian document types, or start a blank freeform draft for anything else.',
  },
  {
    title: 'Fill the form, or brief the AI',
    desc: 'Answer a short guided form — or describe your situation in plain language and let the copilot draft it.',
  },
  {
    title: 'Review the live preview & risks',
    desc: 'A page-faithful, stamp-paper-aware preview updates as you type, with deterministic warnings for anything a court or counterparty might flag.',
  },
  {
    title: 'Export, share or sign',
    desc: 'Download a signature-ready PDF or editable DOCX, share a link, or send it for e-signature.',
  },
];

const FEATURES: {
  icon: IconName;
  title: string;
  desc: string;
  href?: string;
}[] = [
  {
    icon: 'sparkles',
    title: 'AI drafting copilot',
    desc: 'Describe what you need in plain language. The copilot drafts a first version you review, edit and refine — never a black box.',
    href: '/features/ai-drafting',
  },
  {
    icon: 'gavel',
    title: 'Statute-accurate citations',
    desc: 'Citations are looked up from a curated, dated reference library — never invented — and stay current with the 2024 IPC→BNS, CrPC→BNSS and Evidence→BSA reform.',
    href: '/law',
  },
  {
    icon: 'layers',
    title: 'Stamp-paper-aware templates',
    desc: 'See your document exactly as it will print: the right page size, margins and stamp-paper format for your state.',
    href: '/features/templates',
  },
  {
    icon: 'languages',
    title: '13-language transliteration',
    desc: 'Draft names, addresses and clauses in Hindi and 12 other Indian languages, transliterated inline as you type.',
  },
  {
    icon: 'shield',
    title: 'Deterministic risk warnings',
    desc: 'A rule library flags missing witnesses, invalid notice periods and other drafting risks before you sign.',
  },
  {
    icon: 'export',
    title: 'PDF & DOCX export',
    desc: 'Export a signature-ready PDF or an editable DOCX — or continue in the freeform editor for court filings.',
  },
  {
    icon: 'key',
    title: 'Wealth & estate vault',
    desc: 'Track every asset your family owns — including what account aggregators miss — with a nominee and dead-man switch.',
    href: '/features/wealth-vault',
  },
  {
    icon: 'notice',
    title: 'Built for teams, too',
    desc: 'Branded output, higher limits and multi-seat access for advocates, firms and companies drafting at volume.',
    href: '/solutions/business',
  },
  {
    icon: 'document',
    title: 'Self-hosted / enterprise',
    desc: 'Run the whole stack — database, storage and your own AI provider keys — on your own infrastructure.',
    href: '/enterprise',
  },
];

const PLANS = [
  { name: 'Free', price: '₹0', unit: '2 documents, lifetime' },
  { name: 'Starter', price: '₹199', unit: '/mo · 10 docs/mo' },
  { name: 'Pro', price: '₹499', unit: '/mo · PDF + DOCX' },
  { name: 'Advocate', price: '₹999', unit: '/mo · branded, eSign' },
];

const FAQS = [
  {
    q: 'Does the AI ever make up legal citations?',
    a: 'No. Generation prompts keep the applicable-law reference as a placeholder — the actual citation is resolved from a curated, dated library, so you never get a repealed IPC/CrPC/Evidence Act section by mistake.',
  },
  {
    q: 'Which states and stamp-paper sizes are supported?',
    a: 'Templates account for state-specific clauses and stamp-duty conventions, and the preview renders on the correct page and stamp-paper size before you print.',
  },
  {
    q: 'Can I edit a document after the AI drafts it?',
    a: 'Yes. Every AI draft lands in the same editor you would use for a manual draft — nothing is locked, and you can ask the copilot to revise specific clauses.',
  },
  {
    q: 'Is my document data private?',
    a: 'Your documents are stored under your account and are not used to train shared models. You can export or delete them at any time.',
  },
  {
    q: 'Can advocates use this professionally?',
    a: 'Yes — the Advocate plan adds branded PDF/DOCX output, higher AI and document limits, and e-signature support for client-facing work.',
  },
];

/* ── Sections ────────────────────────────────────────────────────────── */

function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.06] via-background to-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl px-5 py-24 text-center sm:py-32">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground/65 shadow-sm">
          <span className="size-1.5 rounded-full bg-success" />
          Aware of the 2024 BNS · BNSS · BSA criminal-code reform
        </p>
        <h1 className="mt-7 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          Legal documents,
          <br className="hidden sm:block" /> drafted right.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-foreground/65 sm:text-lg">
          {SITE_NAME} pairs guided forms with an AI copilot and a
          statute-accurate citation library, so rent agreements, notices,
          affidavits and 19+ other Indian document types come out
          court-ready — not just plausible-looking.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={appHref(authed ? 'dashboard' : 'register', authed)}
            className="rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
          >
            {authed ? 'Go to dashboard' : 'Start drafting free'}
          </a>
          <a
            href="#how"
            className="rounded-lg border border-border px-7 py-3 font-medium text-foreground/80 transition-colors hover:bg-secondary/50"
          >
            See how it works
          </a>
        </div>
        <p className="mt-6 text-xs text-foreground/45">
          No credit card required · Preview any document for free
        </p>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    '19+ Indian document types',
    'Curated, dated statute citations',
    'Stamp-paper-aware preview',
    '13-language transliteration',
  ];
  return (
    <section className="border-y border-border/60 bg-secondary/25 py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 text-center text-xs font-medium uppercase tracking-wide text-foreground/50 sm:justify-between sm:text-sm">
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}

function DocumentTypes({ authed }: { authed: boolean }) {
  return (
    <section id="documents" className="scroll-mt-16 bg-background py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Document library
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            Every document, one source of truth
          </h2>
          <p className="mt-3 text-foreground/65">
            Each type has one schema behind the form, the AI prompts, the
            risk checks and the printed template — so what you see is what
            you sign.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DOCUMENT_TYPES.map((doc, i) => (
            <Reveal key={doc.title} delay={i * 50}>
              <a
                href={appHref(authed ? 'dashboard' : 'register', authed)}
                className="group flex h-full flex-col rounded-2xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon name={doc.icon} className="size-5" />
                  </span>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                    {doc.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {doc.title}
                </h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-foreground/60">
                  {doc.desc}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Draft this
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section id="how" className="scroll-mt-16 bg-secondary/25 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            From blank page to signature-ready
          </h2>
        </Reveal>

        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Reveal delay={i * 80} className="h-full">
                <div className="h-full rounded-2xl border border-border bg-background p-6">
                  <span className="font-display text-2xl font-semibold text-primary">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/60">
                    {step.desc}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Solutions() {
  const cards = [
    {
      href: '/solutions/individuals',
      icon: 'scroll' as IconName,
      title: 'For individuals',
      desc: 'Rent agreements, wills, legal notices and RTI applications — drafted right, without hiring a lawyer for routine paperwork.',
    },
    {
      href: '/solutions/business',
      icon: 'briefcase' as IconName,
      title: 'For business & teams',
      desc: 'NDAs, offer letters, invoices and recovery notices at volume, with branded output for advocates and firms.',
    },
  ];
  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Built for both
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            One platform, two ways to use it
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {cards.map((c, i) => (
            <Reveal key={c.href} delay={i * 80}>
              <Link
                href={c.href}
                className="group flex h-full flex-col rounded-2xl border border-border bg-background p-8 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={c.icon} className="size-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">
                  {c.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/62">
                  {c.desc}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary">
                  Explore
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-background py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Why {SITE_NAME}
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            Built for documents that hold up
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const body = (
              <>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon name={f.icon} className="size-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
                    {f.desc}
                  </p>
                  {f.href && (
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Learn more →
                    </span>
                  )}
                </div>
              </>
            );
            return (
              <Reveal key={f.title} delay={i * 60}>
                {f.href ? (
                  <Link
                    href={f.href}
                    className="flex h-full gap-4 rounded-2xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex h-full gap-4 rounded-2xl border border-border bg-background p-6">
                    {body}
                  </div>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section className="bg-secondary/25 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            Draft for free. Pay to export.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 60}>
              <div className="flex h-full flex-col rounded-2xl border border-border bg-background p-6">
                <h3 className="text-sm font-semibold text-foreground/80">
                  {plan.name}
                </h3>
                <p className="mt-3 font-display text-3xl font-semibold text-foreground">
                  {plan.price}
                </p>
                <p className="mt-1 text-xs text-foreground/55">{plan.unit}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-2 text-center text-sm sm:flex-row sm:gap-6">
          <Link
            href="/pricing"
            className="font-medium text-primary hover:underline"
          >
            Compare all plans →
          </Link>
          <Link
            href="/enterprise"
            className="font-medium text-foreground/65 hover:text-foreground hover:underline"
          >
            Need it on your own servers? See Enterprise →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Faqs() {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            FAQ
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
            Questions, answered
          </h2>
        </Reveal>
        <dl className="mt-12 space-y-4">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 50}>
              <div className="rounded-xl border border-border bg-background p-5">
                <dt className="text-sm font-semibold text-foreground">
                  {f.q}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-foreground/62">
                  {f.a}
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ClosingCta({ authed }: { authed: boolean }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-accent to-primary py-24">
      <div className="relative mx-auto max-w-2xl px-5 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold leading-tight text-primary-foreground sm:text-4xl">
            Draft your next document in minutes, not billable hours.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-primary-foreground/80">
            Start free — upgrade only when you're ready to export.
          </p>
          <a
            href={appHref(authed ? 'dashboard' : 'register', authed)}
            className="mt-8 inline-block rounded-lg bg-background px-8 py-3.5 font-medium text-foreground shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
          >
            {authed ? 'Go to dashboard' : 'Start drafting free'}
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export function Landing({ authed }: { authed: boolean }) {
  return (
    <main className="bg-background">
      <Hero authed={authed} />
      <TrustBar />
      <DocumentTypes authed={authed} />
      <Steps />
      <Solutions />
      <Features />
      <PricingTeaser />
      <Faqs />
      <ClosingCta authed={authed} />
    </main>
  );
}
