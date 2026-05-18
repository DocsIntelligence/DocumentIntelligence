import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { I18nProvider } from '../lib/i18n-provider';
import { Providers } from '../lib/providers';
import { SITE_NAME } from '../lib/site';
import './global.css';

export const metadata = {
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: 'Public marketing site (Next.js).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          <Providers>{children}</Providers>
        </I18nProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
