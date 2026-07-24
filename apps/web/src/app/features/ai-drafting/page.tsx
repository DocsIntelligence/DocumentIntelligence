import Link from 'next/link';
import { appHref } from '../../../lib/app-href';
import { PageHero } from '../../../components/site/page-hero';
import { SiteFooter } from '../../../components/site/site-footer';
import { SiteHeader } from '../../../components/site/site-header';
import { SITE_NAME } from '../../../lib/site';

export const metadata = {
  title: `AI drafting copilot — ${SITE_NAME}`,
  description:
    'Draft legal documents from a plain-language brief. Structured, schema-validated output — never invented statute citations.',
};

const STEPS = [
  {
    n: '01',
    title: 'Describe your situation',
    desc: 'Write a plain-language brief — "cheque bounced, ₹40,000, need a demand notice under NI Act" — instead of filling every field by hand.',
  },
  {
    n: '02',
    title: 'The copilot returns structured data, not prose',
    desc: 'Generation targets the exact same Zod schema the form and the printed template use — asked for JSON, not a paragraph that merely sounds like a document.',
  },
  {
    n: '03',
    title: 'Unknown facts become placeholders',
    desc: 'When the brief omits a required detail, the copilot leaves a highlighted {{placeholder}} instead of guessing a name, date or amount.',
  },
  {
    n: '04',
    title: 'A deterministic risk pass runs after generation',
    desc: 'The same rule library that checks a manually-filled form checks an AI draft — missing witnesses, invalid notice periods, and similar issues are flagged before export.',
  },
];

const GUARDRAILS = [
  {
    title: 'The AI never authors a statute citation',
    desc: 'Citation fields are left blank by the model and resolved server-side from a curated, dated reference library — the same one that powers the public law library. A model trained before mid-2024 would otherwise default to repealed IPC/CrPC/Evidence Act sections.',
  },
  {
    title: 'Structured outputs, hard-validated',
    desc: "The model's response is required to satisfy the document type's schema. If it doesn't, the request is rejected and retried once — you never see malformed data.",
  },
  {
    title: 'Revisions are diffs, not silent edits',
    desc: '"Change the notice period to 60 days" returns a reviewable diff against the current draft. Nothing is applied until you accept it — you stay the author of record.',
  },
  {
    title: 'Every version is snapshotted',
    desc: 'Each AI draft and each accepted revision creates a new document version, so undoing an AI change is a click, not a support ticket.',
  },
];

export default function AiDraftingPage() {
  return (
    <>
      <SiteHeader authed={false} />
      <main className="bg-background">
        <PageHero
          eyebrow="Feature — AI drafting copilot"
          title="Draft from a brief, not a blank page."
          subtitle="Describe what you need in plain language. The copilot returns schema-valid data — the same data your form and your printed template use — with statute citations resolved from a curated library, never invented."
          actions={
            <>
              <a
                href={appHref('register')}
                className="rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                Try it free
              </a>
              <Link
                href="/features/templates"
                className="rounded-lg border border-border px-7 py-3 font-medium text-foreground/80 transition-colors hover:bg-secondary/50"
              >
                See the templates it fills →
              </Link>
            </>
          }
        />

        <section className="bg-background py-20">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              How generation actually works
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <span className="font-display text-2xl font-semibold text-primary">
                    {step.n}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary/25 py-20">
          <div className="mx-auto max-w-3xl px-5 text-center">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
                aria-hidden="true"
              >
                <path d="M12 3l7 3v5c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V6z" />
                <path d="M9 12l2 2 4-4.4" />
              </svg>
            </span>
            <h2 className="mt-5 font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Guardrails, not marketing copy
            </h2>
            <p className="mt-3 text-foreground/65">
              These are load-bearing product decisions, not disclaimers.
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 px-5 sm:grid-cols-2">
            {GUARDRAILS.map((g) => (
              <div
                key={g.title}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  {g.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                  {g.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Try it on a real document
            </h2>
            <p className="mt-3 text-foreground/65">
              Free to draft and preview. Pay only when you export.
            </p>
            <a
              href={appHref('register')}
              className="mt-7 inline-block rounded-lg bg-primary px-8 py-3.5 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
            >
              Start drafting free
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
