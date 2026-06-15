import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { WEB_ENV } from '../../../config';
import { SITE_NAME } from '../../../lib/site';
import {
  citationSlug,
  fetchPublicCitation,
  slugToId,
} from '../../../lib/law';

interface Params {
  id: string;
}

// Same rationale as /law/page.tsx — defer to request-time SSR so the build
// step stays decoupled from the public-API availability (and from any
// pre-existing client-provider breakage at SSG time). Bots still see fully-
// rendered HTML; we just don't pre-warm the cache at build.
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const citation = await fetchPublicCitation(slugToId(id));
  if (!citation) {
    return { title: `Citation not found — ${SITE_NAME}` };
  }
  const head = `${citation.actShort ?? citation.act}${citation.section ? ` §${citation.section}` : ''} — ${citation.title}`;
  const desc = citation.summary.replace(/\s+/g, ' ').slice(0, 160);
  const url = `${WEB_ENV.webUrl}/law/${citationSlug(citation.id)}`;
  return {
    title: `${head} · ${SITE_NAME}`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: head,
      description: desc,
      url,
      siteName: SITE_NAME,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: head,
      description: desc,
    },
  };
}

export default async function LawDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const citation = await fetchPublicCitation(slugToId(id));
  if (!citation) notFound();

  // When this citation supersedes another (e.g. BNSS §223 ← CrPC §200), fetch
  // the predecessor so we can render a "What changed" side-by-side. The
  // predecessor lives in the catalog when curated; missing rows just hide
  // the comparison panel rather than 404.
  const predecessor = citation.supersedes
    ? await fetchPublicCitation(citation.supersedes)
    : null;

  const head = `${citation.actShort ?? citation.act}${citation.section ? ` §${citation.section}` : ''} — ${citation.title}`;
  const url = `${WEB_ENV.webUrl}/law/${citationSlug(citation.id)}`;
  // JSON-LD: Legislation entity — Google's rich-result schema.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: head,
    legislationIdentifier: citation.id,
    legislationJurisdiction: citation.jurisdiction ?? 'IN',
    url,
    inLanguage: 'en',
  };
  if (citation.effectiveFrom) jsonLd['legislationDate'] = citation.effectiveFrom;
  if (citation.summary) jsonLd['description'] = citation.summary;
  if (citation.externalUrl) jsonLd['sameAs'] = citation.externalUrl;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40">
          <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
            <Link
              href="/law"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              ← Law Library
            </Link>
            <Link
              href="/"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              {SITE_NAME}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-info text-info-foreground px-2 py-0.5 text-xs font-medium">
                {citation.actShort ?? citation.act}
                {citation.section ? ` §${citation.section}` : ''}
              </span>
              {citation.confidence === 'high' && (
                <span className="inline-flex items-center rounded-full border border-success text-success px-2 py-0.5 text-[10px]">
                  verified
                </span>
              )}
              {citation.effectiveFrom && (
                <span className="text-xs text-foreground/45">
                  effective {citation.effectiveFrom}
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              {citation.title}
            </h1>
            <p className="mt-2 text-sm text-foreground/60">{citation.act}</p>
          </div>

          <article className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/55 mb-2">
              Summary
            </h2>
            <p className="text-foreground/80 leading-relaxed whitespace-pre-line">
              {citation.summary}
            </p>
          </article>

          {predecessor && (
            <article className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/55">
                  What changed
                </h2>
                <span className="text-[10px] text-foreground/45">
                  {predecessor.actShort ?? predecessor.act}
                  {predecessor.section ? ` §${predecessor.section}` : ''} →{' '}
                  {citation.actShort ?? citation.act}
                  {citation.section ? ` §${citation.section}` : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-medium">
                      Before · repealed
                    </span>
                  </div>
                  <h3 className="font-medium text-foreground">
                    {predecessor.actShort ?? predecessor.act}
                    {predecessor.section ? ` §${predecessor.section}` : ''} —{' '}
                    {predecessor.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/70 leading-relaxed whitespace-pre-line">
                    {predecessor.summary}
                  </p>
                </div>
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-medium">
                      After · current
                    </span>
                    {citation.effectiveFrom && (
                      <span className="text-[10px] text-foreground/50">
                        eff. {citation.effectiveFrom}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-foreground">
                    {citation.actShort ?? citation.act}
                    {citation.section ? ` §${citation.section}` : ''} —{' '}
                    {citation.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/70 leading-relaxed whitespace-pre-line">
                    {citation.summary}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-foreground/50">
                Drafting reference only — section numbers + scope of change
                are curated and may need verification against the bare act.
              </p>
            </article>
          )}

          {citation.draftingTips && (
            <article className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/55 mb-2">
                Drafting tips
              </h2>
              <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                {citation.draftingTips}
              </pre>
            </article>
          )}

          {citation.verifyNote && (
            <p className="text-xs text-foreground/50 italic">
              {citation.verifyNote}
            </p>
          )}

          {citation.appliesTo && citation.appliesTo.length > 0 && (
            <article className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/55 mb-2">
                Documents that use this section
              </h2>
              <ul className="space-y-1.5 text-sm">
                {citation.appliesTo.map((k) => (
                  <li key={k}>
                    <a
                      href={`${WEB_ENV.webUrl.replace('//', '//app.').replace('://app.app.', '://app.')}/documents/templates?type=${k}`}
                      className="text-primary hover:underline capitalize"
                    >
                      {k.replace(/_/g, ' ')} — draft now →
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          )}

          {citation.externalUrl && (
            <article className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/55 mb-2">
                Official source
              </h2>
              <a
                href={citation.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {citation.externalUrl} ↗
              </a>
            </article>
          )}

          <p className="text-xs text-foreground/45">
            Drafting reference only — verify against the bare act before
            binding use.
          </p>
        </main>
      </div>
    </>
  );
}
