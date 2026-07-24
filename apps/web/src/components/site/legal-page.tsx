import type { ReactNode } from 'react';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-foreground/50">
          Last updated {updated}
        </p>
        <div className="prose-legal mt-10 space-y-8 text-sm leading-relaxed text-foreground/75">
          {children}
        </div>
      </div>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="mt-2.5 space-y-3">{children}</div>
    </section>
  );
}
