import Link from 'next/link';
import type { Metadata } from 'next';
import { WEB_ENV } from '../../config';
import { appHref } from '../../lib/app-href';
import { SITE_NAME } from '../../lib/site';
import {
  citationSlug,
  fetchPublicCitations,
  type PublicCitation,
} from '../../lib/law';

export const metadata: Metadata = {
  title: `Indian statutory references — ${SITE_NAME}`,
  description:
    'A curated, drafter-grade explainer of the statutes our document templates reference. Each entry links to the official bare-act source.',
  alternates: { canonical: `${WEB_ENV.webUrl}/law` },
  openGraph: {
    title: `Indian statutory references — ${SITE_NAME}`,
    description:
      'Drafter-grade explainers for the statutes we cite — NI Act §138, BNSS §223, RTI Act, more.',
    url: `${WEB_ENV.webUrl}/law`,
    siteName: SITE_NAME,
    type: 'website',
  },
};

// ISR — refresh the page every 5 minutes; admin edits show up quickly without
// burning a fresh render per request.
//
// `dynamic = 'force-dynamic'` defers rendering to request time. We render
// SSR-on-demand (still SEO-grade — bots see fully-rendered HTML), but skip
// build-time pre-rendering so we don't crash a `next build` if any upstream
// client provider in the shared layout misbehaves during static export.
// Revert to static + ISR once the layout's `Providers` component renders
// cleanly under SSG.
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function LawCatalogPage() {
  const rows = await fetchPublicCitations();
  const grouped = groupByAct(rows);

  // JSON-LD: list of legislation references. Helps Google understand it's a
  // structured catalog rather than a generic blog index.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Indian statutory references',
    url: `${WEB_ENV.webUrl}/law`,
    hasPart: rows.map((c) => ({
      '@type': 'Legislation',
      name: `${c.actShort ?? c.act}${c.section ? ` §${c.section}` : ''} — ${c.title}`,
      legislationIdentifier: c.id,
      url: `${WEB_ENV.webUrl}/law/${citationSlug(c.id)}`,
      legislationDate: c.effectiveFrom,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link
              href="/law"
              className="font-semibold tracking-tight text-foreground"
            >
              {SITE_NAME} · Law Library
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/"
                className="text-foreground/70 hover:text-foreground"
              >
                Home
              </Link>
              <a
                href={appHref('dashboard', true)}
                className="text-foreground/70 hover:text-foreground"
              >
                Draft documents
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Indian statutory references
            </h1>
            <p className="mt-3 max-w-2xl text-foreground/60 leading-relaxed">
              Curated, drafter-grade explainers for the statutes our document
              templates reference. Every entry links out to the official
              bare-act on{' '}
              <a
                href="https://www.indiacode.nic.in"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                indiacode.nic.in
              </a>{' '}
              — we add the drafting context the bare text omits.
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="text-foreground/50 py-10 text-center">
              No citations available right now.
            </p>
          ) : (
            grouped.map(([act, list]) => (
              <section key={act}>
                <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/55 mb-3">
                  {act}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {list.map((c) => (
                    <CitationCard key={c.id} c={c} />
                  ))}
                </div>
              </section>
            ))
          )}
        </main>

        <footer className="border-t border-border/40 mt-10">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-foreground/45">
            Drafting reference only — verify against the bare act before
            binding use. We link to indiacode.nic.in for the canonical text.
          </div>
        </footer>
      </div>
    </>
  );
}

function CitationCard({ c }: { c: PublicCitation }) {
  return (
    <Link
      href={`/law/${citationSlug(c.id)}`}
      className="block rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center rounded-full bg-info text-info-foreground px-2 py-0.5 text-[10px] font-medium">
          {c.actShort ?? c.act}
          {c.section ? ` §${c.section}` : ''}
        </span>
        {c.confidence === 'high' && (
          <span className="inline-flex items-center rounded-full border border-success text-success px-2 py-0.5 text-[10px]">
            verified
          </span>
        )}
      </div>
      <h3 className="font-medium text-foreground line-clamp-2">{c.title}</h3>
      <p className="mt-2 text-sm text-foreground/60 line-clamp-3">{c.summary}</p>
      {c.topics && c.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {c.topics.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
            >
              {tag.replace(/-/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function groupByAct(rows: PublicCitation[]): Array<[string, PublicCitation[]]> {
  const groups = new Map<string, PublicCitation[]>();
  for (const c of rows) {
    const key = c.actShort ?? c.act;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}
