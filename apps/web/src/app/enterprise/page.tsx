import { APP_CONFIG } from '@org/utils';
import { EnterpriseContactForm } from '../../components/site/enterprise-contact-form';
import { PageHero } from '../../components/site/page-hero';
import { SiteFooter } from '../../components/site/site-footer';
import { SiteHeader } from '../../components/site/site-header';
import { SITE_NAME } from '../../lib/site';

export const metadata = {
  title: `Enterprise & self-hosted — ${SITE_NAME}`,
  description:
    'Run the entire platform on your own infrastructure — your database, your storage, your AI provider keys. Nothing leaves your servers.',
};

const INCLUDES = [
  {
    title: 'Deployed on your infrastructure',
    desc: 'Docker images for every service — API, builder, marketing site, PDF render worker — deployed to your own cloud account or data center.',
  },
  {
    title: 'Your database, your storage',
    desc: 'Postgres and S3-compatible storage (or MinIO) that you provision and control. No document, no draft, no vault asset touches our infrastructure.',
  },
  {
    title: 'Bring your own AI provider key',
    desc: 'Point the AI copilot at your own Anthropic, OpenAI or Gemini account — or an internally hosted model — so drafting requests never leave your approved vendor list.',
  },
  {
    title: 'White-label output',
    desc: "Every exported PDF and DOCX carries your organization's branding, not ours.",
  },
  {
    title: 'SSO & access control',
    desc: 'Wire in your existing identity provider instead of managing a separate user directory.',
  },
  {
    title: 'Dedicated support & SLA',
    desc: 'A named point of contact and an agreed response time, not a support queue.',
  },
];

const COMPARISON: [string, string, string][] = [
  ['Hosting', 'Our cloud', 'Your infrastructure'],
  ['Data residency', 'Shared multi-tenant', 'Fully under your control'],
  ['AI provider', 'Managed for you', 'Your own provider account/keys'],
  ['Branding', 'Vidhi (Advocate+: yours)', 'Fully white-labeled'],
  ['Support', 'Standard', 'Dedicated, SLA-backed'],
  ['Billing', 'Monthly per plan', 'Annual license'],
];

export default function EnterprisePage() {
  return (
    <>
      <SiteHeader authed={false} />
      <main className="bg-background">
        <PageHero
          eyebrow="Enterprise edition"
          title="Run it on your own servers."
          subtitle="The self-hosted / enterprise edition puts the whole stack — database, storage and AI provider keys — on your infrastructure. Nothing about a document you draft ever has to leave a system you control."
        />

        <section className="bg-background py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {INCLUDES.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary/25 py-20">
          <div className="mx-auto max-w-4xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Cloud vs. Enterprise
            </h2>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-background text-xs uppercase tracking-wide text-foreground/50">
                    <th className="px-5 py-3 font-medium"></th>
                    <th className="px-5 py-3 font-medium">Cloud plans</th>
                    <th className="px-5 py-3 font-medium">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr
                      key={row[0]}
                      className={i % 2 === 1 ? 'bg-background/60' : 'bg-background'}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {row[0]}
                      </td>
                      <td className="px-5 py-3 text-foreground/65">{row[1]}</td>
                      <td className="px-5 py-3 text-foreground/65">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto grid max-w-5xl gap-12 px-5 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Talk to us
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl">
                Tell us about your deployment
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-foreground/65">
                We'll follow up to understand your data-residency and
                integration requirements, then walk you through licensing and
                a deployment plan.
              </p>
              <p className="mt-6 text-sm text-foreground/55">
                Prefer email?{' '}
                <a
                  href={`mailto:${APP_CONFIG.support.email}`}
                  className="font-medium text-primary hover:underline"
                >
                  {APP_CONFIG.support.email}
                </a>
              </p>
            </div>
            <EnterpriseContactForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
