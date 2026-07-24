import Link from 'next/link';
import { SITE_NAME } from '../../lib/site';

/**
 * Wordmark + a small inline glyph (an open document with a checked clause —
 * standing in for "drafted, verified"). No external asset so it never 404s.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-foreground ${className ?? ''}`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
          <path d="M14 3v4h4" />
          <path d="M8.5 13.2l2 2 4-4.4" />
        </svg>
      </span>
      {SITE_NAME}
    </Link>
  );
}
