import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { usePageHeaderSlot } from './header-slot';

/** A secondary header action — inline on desktop, in a `⋯` menu on mobile. */
export interface PageHeaderAction {
  label: string;
  /** Link target; takes precedence over `onClick`. */
  to?: string;
  onClick?: () => void;
  icon?: ReactNode;
}

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned primary action(s) — always visible (e.g. the main CTA). */
  actions?: ReactNode;
  /**
   * Secondary actions. Rendered inline (ghost buttons) from `sm` up, and
   * collapsed into a single `⋯` overflow menu on mobile so the header never
   * overflows on small screens.
   */
  secondaryActions?: PageHeaderAction[];
  /**
   * Show a Back button just before the title. Defaults to true — section roots
   * (Dashboard, a list landing) should pass `back={false}`.
   */
  back?: boolean;
  /** Explicit back target; defaults to history-back. */
  backTo?: string;
  className?: string;
}

/**
 * Standardized page header used across routes: an optional sidebar-collapse
 * toggle, a Back button (sub-routes), the title + subtitle, and a common
 * actions slot — same layout, spacing, and controls everywhere.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  secondaryActions,
  back = true,
  backTo,
  className,
}: PageHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const slot = usePageHeaderSlot();
  const hasSecondary = !!secondaryActions && secondaryActions.length > 0;

  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {back && (
          <button
            type="button"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            aria-label={t('common.back', 'Back')}
            title={t('common.back', 'Back')}
            className="inline-flex size-8 flex-none items-center justify-center rounded-md text-foreground/55 transition hover:bg-secondary hover:text-foreground"
          >
            <BackIcon />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-foreground/60 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {(slot || actions || hasSecondary) && (
        <div className="flex flex-wrap items-center gap-2 sm:flex-none sm:justify-end">
          {slot}

          {/* Secondary actions — inline from sm up. */}
          {hasSecondary &&
            secondaryActions.map((a, i) =>
              a.to ? (
                <Button
                  key={i}
                  asChild
                  variant="ghost"
                  size="sm"
                  className="hidden gap-1.5 sm:inline-flex"
                >
                  <Link to={a.to}>
                    {a.icon}
                    {a.label}
                  </Link>
                </Button>
              ) : (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  onClick={a.onClick}
                  className="hidden gap-1.5 sm:inline-flex"
                >
                  {a.icon}
                  {a.label}
                </Button>
              ),
            )}

          {actions}

          {/* Secondary actions — `⋯` overflow menu on mobile only. */}
          {hasSecondary && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.moreActions', 'More actions')}
                  className="sm:hidden"
                >
                  <MoreIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondaryActions.map((a, i) =>
                  a.to ? (
                    <DropdownMenuItem key={i} asChild>
                      <Link to={a.to} className="gap-2">
                        {a.icon}
                        {a.label}
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={i} onClick={a.onClick} className="gap-2">
                      {a.icon}
                      {a.label}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}

function MoreIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
