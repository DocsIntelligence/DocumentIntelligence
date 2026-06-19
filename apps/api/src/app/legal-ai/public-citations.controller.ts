import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { CitationAttachmentService } from './citation-attachment.service';
import { LegalReferenceService } from './legal-reference.service';

/**
 * Auth-free citation catalog for the public `/law/*` portal. Mirrors the
 * authed list/get under the same shape so the SPA can fetch the same data
 * without an access token. Every endpoint is `@Public()` so the global
 * JwtAuthGuard doesn't intercept it.
 *
 * Filters out citations the admin has flagged `isPublic=false`.
 */
@ApiTags('public-law')
@Controller('public/law')
export class PublicCitationsController {
  constructor(
    private readonly refs: LegalReferenceService,
    private readonly config: ConfigService,
    private readonly attachments: CitationAttachmentService,
  ) {}

  /** Public host (e.g. https://yourdomain.com) for absolute sitemap URLs. */
  private get publicHost(): string {
    return (
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('APP_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List every public citation' })
  list(
    @Query('topic') topic?: string,
    @Query('act') act?: string,
    @Query('jurisdiction') jurisdiction?: string,
  ) {
    return this.refs.listPublic().then((rows) => {
      let filtered = rows;
      if (jurisdiction) {
        const j = jurisdiction.toUpperCase();
        filtered = filtered.filter(
          (c) => (c.jurisdiction ?? 'IN').toUpperCase() === j,
        );
      }
      if (topic) {
        filtered = filtered.filter((c) => c.topics?.includes(topic));
      }
      if (act) {
        const a = act.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.act.toLowerCase().includes(a) ||
            (c.actShort?.toLowerCase().includes(a) ?? false),
        );
      }
      return filtered;
    });
  }

  @Public()
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Sitemap of every public /law/:id page' })
  async sitemap() {
    const rows = await this.refs.listPublic();
    const host = this.publicHost || 'https://localhost';
    const today = new Date().toISOString().slice(0, 10);
    const entries = rows
      .map((c) => {
        const slug = c.id.replace(/\./g, '-');
        return `  <url>\n    <loc>${host}/law/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
      })
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${host}/law</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n${entries}\n</urlset>\n`;
  }

  @Public()
  @Get(':id/attachments')
  @ApiOperation({
    summary: 'Public files attached to a citation (downloadable bare-acts, commentary)',
  })
  attachmentsFor(@Param('id') id: string) {
    // listPublic() enforces both the citation's and each file's isPublic flag.
    return this.attachments.listPublic(id.replace(/-/g, '.'));
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Fetch one citation by id' })
  async get(@Param('id') id: string) {
    // Accept both 'bnss.223' and the URL-safe 'bnss-223'.
    const normalised = id.replace(/-/g, '.');
    const c = await this.refs.get(normalised);
    if (!c) throw new NotFoundException(`Citation "${id}" not found`);
    // Final guard — never leak a private citation through the public route.
    const publicList = await this.refs.listPublic();
    if (!publicList.some((p) => p.id === c.id)) {
      throw new NotFoundException(`Citation "${id}" not found`);
    }
    return c;
  }
}
