import Link from 'next/link';
import { appHref } from '../../../lib/app-href';
import { PageHero } from '../../../components/site/page-hero';
import { SiteFooter } from '../../../components/site/site-footer';
import { SiteHeader } from '../../../components/site/site-header';
import { SITE_NAME } from '../../../lib/site';

export const metadata = {
  title: `Document templates — ${SITE_NAME}`,
  description:
    'Page-faithful, stamp-paper-aware templates for 19+ Indian document types — what you preview is what prints.',
};

const TEMPLATES = [
  { type: 'Rent agreement', variant: 'Classic', size: 'A4 / stamp paper' },
  { type: 'Legal notice', variant: 'Formal', size: 'A4' },
  { type: 'Will', variant: 'Standard', size: 'A4' },
  { type: 'Power of attorney', variant: 'Standard', size: 'A4 / stamp paper' },
  { type: 'NDA', variant: 'Standard', size: 'A4' },
  { type: 'Affidavit', variant: 'Default', size: 'A4 / stamp paper' },
  { type: 'Cheque-bounce notice', variant: 'Formal', size: 'A4' },
  { type: 'Anticipatory bail', variant: 'Standard', size: 'Legal' },
  { type: 'Consumer complaint', variant: 'Standard', size: 'A4' },
  { type: 'Employment offer', variant: 'Standard', size: 'A4' },
  { type: 'Promissory note', variant: 'Standard', size: 'A4 / stamp paper' },
  { type: 'RTI application', variant: 'Default', size: 'A4' },
  { type: 'Invoice', variant: 'Standard', size: 'A4' },
  { type: 'Purchase order', variant: 'Standard', size: 'A4' },
  { type: 'Quotation', variant: 'Standard', size: 'A4' },
  { type: 'Payslip', variant: 'Standard', size: 'A4' },
  { type: 'Receipt', variant: 'Standard', size: 'A4' },
  { type: 'Credit note', variant: 'Standard', size: 'A4' },
];

const CAPABILITIES = [
  {
    title: 'Stamp-paper aware',
    desc: 'Rent agreements, affidavits, POAs and promissory notes render on the correct stamp-paper size and margins for the document type — not a generic A4 approximation.',
  },
  {
    title: 'Multi-page pagination that respects clauses',
    desc: 'Long documents paginate without splitting a clause or a signature block mid-page, the same way a court clerk would expect a filed document to look.',
  },
  {
    title: 'One schema, one template — no drift',
    desc: 'Every template reads from the same DocumentTypeBundle as the form and the AI prompts. Add a field to the schema and the template has it — there is no second copy to forget.',
  },
  {
    title: 'Edit inline, see it update live',
    desc: 'The preview is the editor: click a field in the rendered page and edit it directly, watching pagination and layout adjust in real time.',
  },
  {
    title: 'Typeset with real fonts',
    desc: 'Templates load proper typefaces rather than browser-default fonts, so a rendered PDF looks typeset, not like a web page printed to paper.',
  },
  {
    title: 'Export PDF or DOCX',
    desc: 'PDF export renders server-side (Puppeteer) for pixel-perfect fidelity; DOCX export produces an editable file for further redlining offline.',
  },
];

export default function TemplatesPage() {
  return (
    <>
      <SiteHeader authed={false} />
      <main className="bg-background">
        <PageHero
          eyebrow="Feature — Document templates"
          title="What you preview is what prints."
          subtitle="19+ Indian document types, each with a page-faithful, stamp-paper-aware template driven by the same schema as the form — so nothing drifts between what you filled in and what you sign."
          actions={
            <>
              <a
                href={appHref('register')}
                className="rounded-lg bg-primary px-7 py-3 font-medium text-primary-foreground shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                Browse templates free
              </a>
              <Link
                href="/#documents"
                className="rounded-lg border border-border px-7 py-3 font-medium text-foreground/80 transition-colors hover:bg-secondary/50"
              >
                See document types →
              </Link>
            </>
          }
        />

        <section className="bg-background py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              The template library
            </h2>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wide text-foreground/50">
                    <th className="px-5 py-3 font-medium">Document type</th>
                    <th className="px-5 py-3 font-medium">Template</th>
                    <th className="px-5 py-3 font-medium">Page format</th>
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATES.map((t, i) => (
                    <tr
                      key={t.type}
                      className={i % 2 === 1 ? 'bg-secondary/10' : undefined}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {t.type}
                      </td>
                      <td className="px-5 py-3 text-foreground/65">
                        {t.variant}
                      </td>
                      <td className="px-5 py-3 text-foreground/65">
                        {t.size}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-secondary/25 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="text-center font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Built for print, not just for screens
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-border bg-background p-6"
                >
                  <h3 className="text-base font-semibold text-foreground">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/62">
                    {c.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              See a template with your own data
            </h2>
            <p className="mt-3 text-foreground/65">
              Free to preview. Pay only when you export.
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
