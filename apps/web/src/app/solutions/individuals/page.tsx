import Link from 'next/link';
import { appHref } from '../../../lib/app-href';
import { PageHero } from '../../../components/site/page-hero';
import { SiteFooter } from '../../../components/site/site-footer';
import { SiteHeader } from '../../../components/site/site-header';
import { SITE_NAME } from '../../../lib/site';

export const metadata = {
  title: `For individuals — ${SITE_NAME}`,
  description:
    'Rent agreements, wills, legal notices and RTI applications — drafted right, without hiring a lawyer for routine paperwork.',
};

const USE_CASES: {
  title: string;
  desc: string;
  href: string;
  external?: boolean;
}[] = [
  {
    title: 'Renting a new flat',
    desc: 'A state-correct rent agreement with the right stamp-duty clauses, ready before your landlord asks for one.',
    href: appHref('register'),
    external: true,
  },
  {
    title: 'A cheque bounced on you',
    desc: 'A demand notice under NI Act §138, with the statutory 15-day/30-day windows built into the draft, not left for you to remember.',
    href: '/features/ai-drafting',
  },
  {
    title: 'Writing your will',
    desc: 'An execution-ready will with witness blocks — paired with the wealth vault so your nominee actually knows what you own.',
    href: '/features/wealth-vault',
  },
  {
    title: 'A government department is stonewalling you',
    desc: 'A properly formatted RTI application addressed to the right PIO, in minutes.',
    href: appHref('register'),
    external: true,
  },
  {
    title: 'Giving a parent power of attorney',
    desc: 'General or special POA, notarization-ready, without a trip to a drafting clerk.',
    href: appHref('register'),
    external: true,
  },
  {
    title: 'A shop or seller won\'t honour a warranty',
    desc: 'A consumer complaint filed the way the forum actually expects it, citing the Consumer Protection Act.',
    href: appHref('register'),
    external: true,
  },
];

const WHY = [
  {
    title: 'Free to draft and preview',
    desc: "Fill the form, see the finished page, decide if it's right — pay only when you're ready to export.",
  },
  {
    title: 'No legalese to decode',
    desc: 'Every field has plain-language help text, and the AI copilot can draft a first version from a sentence.',
  },
  {
    title: "Citations you don't have to double-check",
    desc: 'Statute references are pulled from a curated, dated library — already updated for the 2024 BNS/BNSS/BSA reform.',
  },
];

export default function IndividualsSolutionPage() {
  return (
    <>
      <SiteHeader authed={false} />
      <main className="bg-background">
        <PageHero
          eyebrow="For individuals"
          title="For the paperwork adults actually have to deal with."
          subtitle="Rent agreements, notices, wills and RTI applications — one guided flow, an AI copilot when you're not sure where to start, and a document that looks like it came from someone who does this for a living."
          actions={
            <>
              <a
                href={appHref('register')}
                className="rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                Start drafting free
              </a>
              <Link
                href="/pricing"
                className="rounded-lg border border-border px-7 py-3 font-medium text-foreground/80 transition-colors hover:bg-secondary/50"
              >
                See individual pricing →
              </Link>
            </>
          }
        />

        <section className="bg-background py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Situations people actually show up with
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {USE_CASES.map((u) => {
                const cardClassName =
                  'group flex h-full flex-col rounded-2xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5';
                const content = (
                  <>
                    <h3 className="text-base font-semibold text-foreground">
                      {u.title}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/62">
                      {u.desc}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                      Get started
                      <span className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </span>
                  </>
                );
                return u.external ? (
                  <a key={u.title} href={u.href} className={cardClassName}>
                    {content}
                  </a>
                ) : (
                  <Link key={u.title} href={u.href} className={cardClassName}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-secondary/25 py-20">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Why individuals draft here instead of a template PDF
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {WHY.map((w) => (
                <div key={w.title}>
                  <h3 className="text-base font-semibold text-foreground">
                    {w.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                    {w.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Draft your first document free
            </h2>
            <p className="mt-3 text-foreground/65">
              No credit card required. 2 documents on us.
            </p>
            <a
              href={appHref('register')}
              className="mt-7 inline-block rounded-lg bg-primary px-8 py-3.5 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
            >
              Create free account
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
