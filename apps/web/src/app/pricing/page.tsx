import { APP_CONFIG } from '@org/utils';
import Link from 'next/link';
import { WEB_ENV } from '../../config';

const API_URL = WEB_ENV.apiUrl;

async function getPlans() {
  try {
    const res = await fetch(`${API_URL}/payment/plans`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const metadata = {
  title: `Pricing — ${APP_CONFIG.name}`,
  description: 'Choose the plan that works for you',
};

export default async function PricingPage() {
  const plans = await getPlans();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-foreground">
            {APP_CONFIG.name}
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-foreground/70 hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold text-foreground">
          Simple, transparent pricing
        </h1>
        <p className="text-foreground/60 mt-3 max-w-md mx-auto">
          Choose the plan that fits your needs. Upgrade or downgrade anytime.
        </p>
      </section>

      {/* Plans grid */}
      <section className="mx-auto px-4 pb-20">
        {plans.length === 0 ? (
          <p className="text-center text-foreground/50">
            No plans available yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan: any) => (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-xl border border-border bg-background p-6 shadow-sm"
              >
                {plan.discountLabel && (
                  <span className="absolute -top-3 left-4 px-3 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                    {plan.discountLabel}
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="text-sm text-foreground/60 mt-1">
                    {plan.description}
                  </p>
                )}

                <div className="mt-4">
                  <span className="text-3xl font-bold text-foreground">
                    {APP_CONFIG.payment.currencySymbol}
                    {plan.price}
                  </span>
                  {plan.originalPrice && (
                    <span className="ml-2 text-sm text-foreground/40 line-through">
                      {APP_CONFIG.payment.currencySymbol}
                      {plan.originalPrice}
                    </span>
                  )}
                  <span className="text-sm text-foreground/60 ml-1">
                    /
                    {plan.interval === 'monthly'
                      ? 'mo'
                      : plan.interval === 'yearly'
                        ? 'yr'
                        : plan.interval}
                  </span>
                </div>

                {/* Features */}
                <ul className="mt-6 space-y-2 flex-1">
                  {plan.features?.map((f: any) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-2 text-sm text-foreground/80"
                    >
                      <svg
                        className="size-4 text-success shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>
                        {f.quantity === -1 ? 'Unlimited' : f.quantity}{' '}
                        {f.name.replace(/_/g, ' ')}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className="mt-6 block text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
