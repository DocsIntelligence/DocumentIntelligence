'use client';

import Link from 'next/link';
import { useState } from 'react';
import { appHref } from '../../lib/app-href';
import { BrandLogo } from './brand-logo';

type NavLink = { href: string; label: string; desc?: string };
type NavItem =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'menu'; label: string; items: NavLink[] };

const NAV: NavItem[] = [
  {
    kind: 'menu',
    label: 'Features',
    items: [
      {
        href: '/features/ai-drafting',
        label: 'AI drafting copilot',
        desc: 'Draft from a plain-language brief',
      },
      {
        href: '/features/templates',
        label: 'Document templates',
        desc: '19+ page-faithful, stamp-paper-aware layouts',
      },
      {
        href: '/features/wealth-vault',
        label: 'Wealth & estate vault',
        desc: 'Net worth, nominees, dead-man switch',
      },
    ],
  },
  {
    kind: 'menu',
    label: 'Solutions',
    items: [
      {
        href: '/solutions/individuals',
        label: 'For individuals',
        desc: 'Rent, wills, notices — drafted right',
      },
      {
        href: '/solutions/business',
        label: 'For business & teams',
        desc: 'Contracts, HR paperwork, at volume',
      },
    ],
  },
  { kind: 'link', href: '/law', label: 'Law library' },
  { kind: 'link', href: '/pricing', label: 'Pricing' },
  { kind: 'link', href: '/enterprise', label: 'Enterprise' },
];

function DesktopMenu({ item }: { item: Extract<NavItem, { kind: 'menu' }> }) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-foreground/65 transition-colors hover:text-foreground"
      >
        {item.label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 transition-transform group-hover:rotate-180"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="rounded-xl border border-border bg-background p-2 shadow-xl shadow-black/5">
          {item.items.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-lg px-3 py-2.5 hover:bg-secondary/50"
            >
              <p className="text-sm font-medium text-foreground">
                {link.label}
              </p>
              {link.desc && (
                <p className="mt-0.5 text-xs text-foreground/55">
                  {link.desc}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({ authed = false }: { authed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <BrandLogo />

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) =>
            item.kind === 'link' ? (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-foreground/65 transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <DesktopMenu key={item.label} item={item} />
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {authed ? (
            <a
              href={appHref('dashboard', true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Go to dashboard
            </a>
          ) : (
            <>
              <a
                href={appHref('login')}
                className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                Sign in
              </a>
              <a
                href={appHref('register')}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                Start drafting free
              </a>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex size-9 items-center justify-center rounded-lg text-foreground/70 hover:bg-secondary/60 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="size-5"
            aria-hidden="true"
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) =>
              item.kind === 'link' ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/75 hover:bg-secondary/50 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setMobileMenu((m) => (m === item.label ? null : item.label))
                    }
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground/75 hover:bg-secondary/50 hover:text-foreground"
                  >
                    {item.label}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`size-4 transition-transform ${mobileMenu === item.label ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {mobileMenu === item.label && (
                    <div className="ml-3 flex flex-col gap-0.5 border-l border-border/60 pl-3">
                      {item.items.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setOpen(false)}
                          className="rounded-lg px-3 py-2 text-sm text-foreground/65 hover:bg-secondary/50 hover:text-foreground"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
            {authed ? (
              <a
                href={appHref('dashboard', true)}
                className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
              >
                Go to dashboard
              </a>
            ) : (
              <>
                <a
                  href={appHref('login')}
                  className="rounded-lg px-4 py-2.5 text-center text-sm font-medium text-foreground/75 hover:bg-secondary/50"
                >
                  Sign in
                </a>
                <a
                  href={appHref('register')}
                  className="rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
                >
                  Start drafting free
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
