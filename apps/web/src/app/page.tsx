import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { APP_CONFIG } from '@org/utils';
import { Landing } from '../components/landing/landing';
import { SiteFooter } from '../components/site/site-footer';
import { SiteHeader } from '../components/site/site-header';
import { appHref } from '../lib/app-href';
import { SITE_NAME } from '../lib/site';

export const metadata = {
  title: `${SITE_NAME} — ${APP_CONFIG.tagline}`,
  description: APP_CONFIG.description,
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has('access_token');

  // Everything authenticated lives in apps/app (the React SPA) — this
  // marketing site never renders its own dashboard.
  if (hasSession) {
    redirect(appHref('dashboard', true));
  }

  return (
    <>
      <SiteHeader authed={false} />
      <Landing authed={false} />
      <SiteFooter />
    </>
  );
}
