import type { MetadataRoute } from 'next';
import { WEB_ENV } from '../config';
import { citationSlug, fetchPublicCitations } from '../lib/law';

/**
 * Next-native sitemap. Lists every public citation page + the law index.
 * Static homepage routes can be added here as the marketing surface grows.
 * Refreshed at the same ISR cadence as the pages (5 min).
 */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = WEB_ENV.webUrl.replace(/\/$/, '');
  const citations = await fetchPublicCitations();
  return [
    {
      url: `${host}/`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${host}/law`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...citations.map((c) => ({
      url: `${host}/law/${citationSlug(c.id)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
