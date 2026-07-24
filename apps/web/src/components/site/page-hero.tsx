import type { ReactNode } from 'react';

export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.06] via-background to-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-foreground/65 sm:text-lg">
          {subtitle}
        </p>
        {actions && (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
