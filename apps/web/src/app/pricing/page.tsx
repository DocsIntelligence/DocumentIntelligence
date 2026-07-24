import { APP_CONFIG } from '@org/utils';
import { SiteFooter } from '../../components/site/site-footer';
import { SiteHeader } from '../../components/site/site-header';
import { WEB_ENV } from '../../config';
import { appHref } from '../../lib/app-href';
import { SITE_NAME } from '../../lib/site';

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
  title: `Pricing — ${SITE_NAME}`,
  description: 'Draft for free. Pay only when you export, brand or eSign.',
};

// Shown when /payment/plans hasn't been seeded yet — the same tiers from
// the product pricing hypothesis (docs/02-product-roadmap.md), so the page
// never renders empty in a fresh environment.
const FALLBACK_PLANS = [
  {
    id: 'free',
    name: 'Free',
    description: 'Try the builder and the AI copilot.',
    price: '0',
    interval: 'monthly',
    features: ['2 documents (lifetime)', '5 AI attempts/day', 'Preview only'],
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For occasional personal documents.',
    price: '199',
    interval: 'monthly',
    features: ['10 documents/mo', '100 AI attempts/mo', 'PDF export, all sizes'],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For individuals and advocates drafting regularly.',
    price: '499',
    interval: 'monthly',
    discountLabel: 'Most popular',
    features: [
      '50 documents/mo',
      '500 AI attempts/mo',
      'PDF + DOCX export',
      'Aadhaar eSign',
    ],
  },
  {
    id: 'advocate',
    name: 'Advocate',
    description: 'For verified advocates publishing client work.',
    price: '999',
    interval: 'monthly',
    features: [
      '150 documents/mo',
      '1,500 AI attempts/mo',
      'Branded PDF + DOCX',
      'eSign included',
    ],
  },
];

export default async function PricingPage() {
  const fetchedPlans = await getPlans();
  const plans = fetchedPlans.length > 0 ? fetchedPlans : FALLBACK_PLANS;

  return (
    <>
      <SiteHeader authed={false} />
      <main className="bg-background">
        {/* Hero */}
        <section className="py-16 text-center sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Pricing
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-foreground sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-md text-foreground/60">
            Draft for free. Pay only when you're ready to export, brand or
            eSign. Upgrade or downgrade anytime.
          </p>
        </section>

        {/* Plans grid */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan: any) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border bg-background p-6 ${
                  plan.discountLabel
                    ? 'border-primary shadow-lg shadow-primary/10'
                    : 'border-border'
                }`}
              >
                {plan.discountLabel && (
                  <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    {plan.discountLabel}
                  </span>
                )}
                <h3 className="text-base font-semibold text-foreground">
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="mt-1 text-sm text-foreground/55">
                    {plan.description}
                  </p>
                )}

                <div className="mt-5">
                  <span className="font-display text-3xl font-semibold text-foreground">
                    {APP_CONFIG.payment.currencySymbol}
                    {plan.price}
                  </span>
                  {plan.originalPrice && (
                    <span className="ml-2 text-sm text-foreground/40 line-through">
                      {APP_CONFIG.payment.currencySymbol}
                      {plan.originalPrice}
                    </span>
                  )}
                  {plan.price !== '0' && (
                    <span className="ml-1 text-sm text-foreground/55">
                      /
                      {plan.interval === 'monthly'
                        ? 'mo'
                        : plan.interval === 'yearly'
                          ? 'yr'
                          : plan.interval}
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="mt-6 flex-1 space-y-2.5">
                  {(plan.features ?? []).map((f: any) => {
                    const label =
                      typeof f === 'string'
                        ? f
                        : `${f.quantity === -1 ? 'Unlimited' : f.quantity} ${f.name.replace(/_/g, ' ')}`;
                    return (
                      <li
                        key={f.id ?? label}
                        className="flex items-start gap-2 text-sm text-foreground/75"
                      >
                        <svg
                          className="mt-0.5 size-4 shrink-0 text-success"
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
                        <span>{label}</span>
                      </li>
                    );
                  })}
                </ul>

                <a
                  href={appHref('register')}
                  className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                    plan.discountLabel
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {plan.price === '0' ? 'Start free' : 'Get started'}
                </a>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-sm text-foreground/55">
            Need higher volume or white-label output for a firm?{' '}
            <a
              href={`mailto:${APP_CONFIG.support.email}`}
              className="font-medium text-primary hover:underline"
            >
              Talk to us about the Agency plan
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
