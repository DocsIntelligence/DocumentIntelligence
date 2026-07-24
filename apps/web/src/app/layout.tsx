import { APP_CONFIG } from '@org/utils';
import type { ReactNode } from 'react';
import { Fraunces, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { I18nProvider } from '../lib/i18n-provider';
import { SITE_NAME } from '../lib/site';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700'],
});

export const metadata = {
  title: {
    default: `${SITE_NAME} — ${APP_CONFIG.tagline}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: APP_CONFIG.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <I18nProvider>{children}</I18nProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
