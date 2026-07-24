import Link from 'next/link';
import { APP_CONFIG } from '@org/utils';
import { appHref } from '../../lib/app-href';
import { BrandLogo } from './brand-logo';

const COLUMNS: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}[] = [
  {
    title: 'Features',
    links: [
      { href: '/features/ai-drafting', label: 'AI drafting copilot' },
      { href: '/features/templates', label: 'Document templates' },
      { href: '/features/wealth-vault', label: 'Wealth & estate vault' },
      { href: '/law', label: 'Law library' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { href: '/solutions/individuals', label: 'For individuals' },
      { href: '/solutions/business', label: 'For business & teams' },
      { href: '/enterprise', label: 'Enterprise / self-hosted' },
    ],
  },
  {
    title: 'Product',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/pricing', label: 'Pricing' },
      { href: appHref('register'), label: 'Create account', external: true },
      { href: appHref('login'), label: 'Sign in', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of service' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/25">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <BrandLogo />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-foreground/60">
              {APP_CONFIG.description}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/45">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-foreground/65 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground/65 transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border/60 pt-6 text-xs text-foreground/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {APP_CONFIG.name}. All rights
            reserved.
          </p>
          <p>
            Statute citations sourced from a curated, dated reference library
            — not AI-generated.
          </p>
        </div>
      </div>
    </footer>
  );
}
