import Link from 'next/link';
import { appHref } from '../../../lib/app-href';
import { PageHero } from '../../../components/site/page-hero';
import { SiteFooter } from '../../../components/site/site-footer';
import { SiteHeader } from '../../../components/site/site-header';
import { SITE_NAME } from '../../../lib/site';

export const metadata = {
  title: `Wealth & estate vault — ${SITE_NAME}`,
  description:
    'Track every asset your family owns — including the real estate, gold and unlisted holdings account aggregators can\'t see — and pass it on cleanly with a nominee and a will.',
};

const FEATURES = [
  {
    title: 'Net worth, including what banks can\'t see',
    desc: 'RBI Account Aggregator only covers linked financial accounts. Real estate, physical gold, crypto and unlisted or foreign holdings — the majority of most Indian households\' wealth — are tracked here too.',
  },
  {
    title: 'Nominee + dead-man switch',
    desc: "Set a liveness check-in cadence. Miss enough pings and, after a configurable cooling-off period, your nominee is notified and guided through claiming access — no one has to guess whether something happened to you.",
  },
  {
    title: 'A nominee is a trustee, not an heir',
    desc: "Nomination hands over custody, not ownership — it's designed to pair with a will, not replace one, matching how Indian succession law actually treats a bank nominee.",
  },
  {
    title: 'Envelope encryption, per asset',
    desc: 'Each asset is encrypted with its own key, which is then wrapped separately for you and for each nominee. Granting a nominee access to one asset never exposes a master key to everything else.',
  },
  {
    title: 'Document capture with AI extract-assist',
    desc: 'Upload a policy document, a demat statement, or a CAS (consolidated account statement) — the pipeline extracts holdings automatically instead of manual data entry, including bulk multi-holding imports.',
  },
  {
    title: 'A dated Estate Report, exportable as PDF',
    desc: 'A single, shareable snapshot of net worth, assets and nominees — useful for your own records or to hand to a nominee alongside your will.',
  },
];

export default function WealthVaultPage() {
  return (
    <>
      <SiteHeader authed={false} />
      <main className="bg-background">
        <PageHero
          eyebrow="Feature — Wealth & estate vault"
          title="Every asset your family owns — not just what a bank can see."
          subtitle="A net-worth tracker built for Indian household wealth: real estate, gold, crypto and unlisted holdings included, with a nominee and dead-man-switch so nothing gets orphaned."
          actions={
            <>
              <a
                href={appHref('register')}
                className="rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                Start your vault
              </a>
              <Link
                href="/features/ai-drafting"
                className="rounded-lg border border-border px-7 py-3 font-medium text-foreground/80 transition-colors hover:bg-secondary/50"
              >
                Pair it with a will →
              </Link>
            </>
          }
        />

        <section className="bg-background py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                    {f.desc}
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
                <circle cx="8" cy="15" r="4" />
                <path d="M11 12l8-8M16 7l2 2M19 4l1 1" />
              </svg>
            </span>
            <h2 className="mt-5 font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Security designed for "release only this nominee's slice"
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-foreground/65">
              Most vaults decrypt everything with one master key — fine for a
              single owner, unworkable once a nominee needs access to specific
              assets. Here, every asset gets its own AES-256-GCM data key,
              wrapped independently for the owner and for each nominee, so
              granting access is precise instead of all-or-nothing.
            </p>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Available as an add-on module
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Track it. Nominate someone. Write the will.
            </h2>
            <p className="mt-3 text-foreground/65">
              The vault is a toggleable module — ask about enabling it for
              your account or your organization.
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
                Ask about enabling it for your org
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
