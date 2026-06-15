import type { MetadataRoute } from 'next';
import { WEB_ENV } from '../config';

export default function robots(): MetadataRoute.Robots {
  const host = WEB_ENV.webUrl.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/law', '/law/'],
        disallow: ['/api/', '/login', '/register', '/dashboard'],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  };
}
