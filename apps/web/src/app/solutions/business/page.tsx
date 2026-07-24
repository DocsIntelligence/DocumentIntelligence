import Link from 'next/link';
import { appHref } from '../../../lib/app-href';
import { PageHero } from '../../../components/site/page-hero';
import { SiteFooter } from '../../../components/site/site-footer';
import { SiteHeader } from '../../../components/site/site-header';
import { SITE_NAME } from '../../../lib/site';

export const metadata = {
  title: `For business & teams — ${SITE_NAME}`,
  description:
    'NDAs before a call, offer letters for a new hire, invoices at volume — the paperwork that repeats every week, without redrafting from scratch each time.',
};

const USE_CASES = [
  {
    title: 'An NDA before every sales call',
    desc: 'Mutual or one-way, generated in the time it takes to schedule the meeting.',
  },
  {
    title: 'Offer letters for a growing team',
    desc: 'Consistent compensation, notice-period and clause language across every hire.',
  },
  {
    title: 'Invoices, POs and quotations',
    desc: 'Standard business documents at volume, without a spreadsheet-and-Word-template workflow.',
  },
  {
    title: 'Recovery and cheque-bounce notices',
    desc: 'When a client payment fails, send a properly formatted NI Act §138 notice the same day.',
  },
  {
    title: 'Advocates drafting for clients',
    desc: 'Branded PDF and DOCX output on the Advocate plan, so what you send out carries your firm\'s name, not ours.',
  },
  {
    title: 'Vendor and consultant contracts',
    desc: 'Consistent terms across every vendor relationship your team signs.',
  },
];

const SCALE_FEATURES = [
  {
    title: 'Branded, white-label output',
    desc: 'Advocate and Agency plans replace our branding on exported PDF/DOCX with yours.',
  },
  {
    title: 'Higher document and AI limits',
    desc: 'Pro, Advocate and Agency tiers scale from 50 to unlimited documents a month, with AI attempts to match.',
  },
  {
    title: 'Seats for a whole team',
    desc: 'The Agency plan adds per-seat access so a firm or company can draft under one account.',
  },
  {
    title: 'Need more than that?',
    desc: 'Self-hosted / enterprise deployment puts the entire stack — AI keys included — on your own infrastructure.',
  },
];

export default function BusinessSolutionPage() {
  return (
    <>
      <SiteHeader authed={false} />
      <main className="bg-background">
        <PageHero
          eyebrow="For business & teams"
          title="For the paperwork that repeats every week."
          subtitle="NDAs before a call, offer letters for a new hire, invoices at volume, recovery notices when a payment fails — one system instead of a folder of half-updated Word templates."
          actions={
            <>
              <a
                href={appHref('register')}
                className="rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                Start free
              </a>
              <Link
                href="/enterprise"
                className="rounded-lg border border-border px-7 py-3 font-medium text-foreground/80 transition-colors hover:bg-secondary/50"
              >
                Talk to us about Enterprise →
              </Link>
            </>
          }
        />

        <section className="bg-background py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              What teams actually draft here
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map((u) => (
                <div
                  key={u.title}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {u.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                    {u.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary/25 py-20">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Built to scale past one person
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {SCALE_FEATURES.map((f) => (
                <div key={f.title}>
                  <h3 className="text-base font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/pricing"
                className="text-sm font-medium text-primary hover:underline"
              >
                Compare Pro, Advocate and Agency plans →
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Bring your whole team
            </h2>
            <p className="mt-3 text-foreground/65">
              Start on Pro, upgrade to Agency when you need seats — or run it
              entirely on your own servers.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={appHref('register')}
                className="rounded-lg bg-primary px-8 py-3.5 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                Start free
              </a>
              <Link
                href="/enterprise"
                className="rounded-lg border border-border px-8 py-3.5 font-medium text-foreground/80 transition-colors hover:bg-secondary/50"
              >
                Talk to us about Enterprise
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
