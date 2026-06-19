import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CitationAnalyzerService } from './citation-analyzer.service';
import {
  CitationApplyService,
  type ApplyFixAction,
} from './citation-apply.service';
import { CitationAttachmentService } from './citation-attachment.service';
import { CitationCritiqueService } from './citation-critique.service';
import { CitationImportService } from './citation-import.service';
import { CitationSuggesterService } from './citation-suggester.service';
import { CitationSyncService } from './citation-sync.service';
import { LegalReferenceService } from './legal-reference.service';
import {
  ClauseRewriteDto,
  RuleSuggestDto,
  GenerateDocumentDto,
  ReviseDocumentDto,
  StatuteImportParseDto,
  StatuteJsonImportDto,
  StatuteImportCommitDto,
  BulkCitationActionDto,
} from './legal-ai.dto';
import { LegalAiService } from './legal-ai.service';

@ApiTags('legal-ai')
@Controller('legal-ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class LegalAiController {
  constructor(
    private readonly legalAi: LegalAiService,
    private readonly analyzer: CitationAnalyzerService,
    private readonly refs: LegalReferenceService,
    private readonly sync: CitationSyncService,
    private readonly apply: CitationApplyService,
    private readonly critique: CitationCritiqueService,
    private readonly suggester: CitationSuggesterService,
    private readonly importer: CitationImportService,
    private readonly attachments: CitationAttachmentService,
  ) {}

  @Post('clause-rewrite')
  @ApiOperation({ summary: 'Rewrite a clause in a chosen tone' })
  clauseRewrite(@CurrentUser() user: User, @Body() body: ClauseRewriteDto) {
    return this.legalAi.clauseRewrite(user.id, body);
  }

  @Post('rule-suggest')
  @ApiOperation({ summary: 'Suggest fair house-rule clauses' })
  ruleSuggest(@CurrentUser() user: User, @Body() body: RuleSuggestDto) {
    return this.legalAi.ruleSuggest(user.id, body);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Draft a whole document as editor-ready HTML from a brief',
  })
  generate(@CurrentUser() user: User, @Body() body: GenerateDocumentDto) {
    return this.legalAi.generateDocument(user.id, body);
  }

  @Post('revise')
  @ApiOperation({
    summary: "Apply an instruction to an existing document's HTML",
  })
  revise(@CurrentUser() user: User, @Body() body: ReviseDocumentDto) {
    return this.legalAi.reviseDocument(user.id, body);
  }

  // ── Citation analyzer + catalog ────────────────────────────────────────

  @Get('citations/document/:documentId/analyze')
  @ApiOperation({
    summary: 'Analyze a document for citation health (present / stale / missing)',
  })
  analyzeDocument(
    @CurrentUser() user: User,
    @Param('documentId') documentId: string,
  ) {
    return this.analyzer.analyzeDocument(user.id, documentId);
  }

  @Post('citations/analyze-text')
  @ApiOperation({ summary: 'Analyze raw HTML/text against the citation catalog' })
  analyzeText(
    @Body() body: { html: string; documentTypeKey?: string },
  ) {
    return this.analyzer.analyzeText(body.html, body.documentTypeKey);
  }

  @Get('citations')
  @ApiOperation({ summary: 'List the citation catalog (logged-in users)' })
  listCitations() {
    return this.refs.list();
  }

  @Get('citations/:id')
  getCitation(@Param('id') id: string) {
    return this.refs.get(id);
  }

  // ── Admin CRUD (no role gate yet per the user's "open it up for now" rule) ──

  @Get('admin/citations')
  listAdmin(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sort') sort?: string,
    @Query('dir') dir?: string,
    @Query('active') active?: string,
    @Query('public') isPublic?: string,
    @Query('act') act?: string,
  ) {
    const triState = (v: string | undefined) =>
      v === 'true' ? true : v === 'false' ? false : undefined;
    return this.refs.listAdmin({
      q: q || undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      sort: (sort as 'id' | 'title' | 'act') ?? undefined,
      dir: (dir as 'asc' | 'desc') ?? undefined,
      active: triState(active),
      isPublic: triState(isPublic),
      act: act || undefined,
    });
  }

  @Get('admin/citations/:id')
  getAdminCitation(@Param('id') id: string) {
    return this.refs.getAdmin(id);
  }

  @Patch('admin/citations/:id')
  upsertCitation(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.refs.createOrUpdate({ ...body, id });
  }

  @Patch('admin/citations/:id/active')
  setActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.refs.setActive(id, body.isActive).then(() => ({ ok: true }));
  }

  @Patch('admin/citations/:id/public')
  setPublic(
    @Param('id') id: string,
    @Body() body: { isPublic: boolean },
  ) {
    return this.refs.setPublic(id, body.isPublic).then(() => ({ ok: true }));
  }

  @Delete('admin/citations/:id')
  removeCitation(@Param('id') id: string) {
    return this.refs.remove(id).then(() => ({ ok: true }));
  }

  @Post('admin/citations/bulk')
  @ApiOperation({
    summary:
      'Bulk action over selected citations (delete / activate / deactivate / make public / make private)',
  })
  bulkCitations(@Body() body: BulkCitationActionDto) {
    return this.refs.bulkAction(body.ids, body.action);
  }

  @Post('admin/citations/:id/sync')
  @ApiOperation({
    summary: 'Pull section text from the official source (indiacode.nic.in for IN) and AI-summarise',
  })
  syncCitation(@Param('id') id: string) {
    return this.sync.syncFromSource(id);
  }

  @Post('admin/citations/:id/enrich')
  @ApiOperation({
    summary:
      'AI-summarise a citation from its already-stored text (e.g. bulk-imported) — fills summary + drafting tips, no source re-fetch',
  })
  enrichCitation(@Param('id') id: string) {
    return this.sync.enrichFromStored(id);
  }

  // ── Citation file attachments (bare-act PDFs, commentary, judgments) ─────

  @Get('admin/citations/:id/attachments')
  @ApiOperation({ summary: 'List files attached to a citation (admin)' })
  listAttachments(@Param('id') id: string) {
    return this.attachments.list(id);
  }

  @Post('admin/citations/:id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Attach a file (PDF / Word / image) to a citation — e.g. a longer bare-act or commentary doc',
  })
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; kind?: string; isPublic?: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.attachments.upload(id, file, {
      title: body.title,
      kind: body.kind,
      // multipart form fields arrive as strings — coerce the flag.
      isPublic:
        body.isPublic === undefined ? undefined : body.isPublic !== 'false',
    });
  }

  @Patch('admin/citations/:id/attachments/:attId/public')
  @ApiOperation({ summary: 'Toggle whether an attachment shows on the public /law page' })
  setAttachmentPublic(
    @Param('id') id: string,
    @Param('attId') attId: string,
    @Body() body: { isPublic: boolean },
  ) {
    return this.attachments.setPublic(id, attId, Boolean(body.isPublic));
  }

  @Delete('admin/citations/:id/attachments/:attId')
  @ApiOperation({ summary: 'Remove a citation attachment (deletes the stored file)' })
  removeAttachment(@Param('id') id: string, @Param('attId') attId: string) {
    return this.attachments.remove(id, attId);
  }

  // ── Bulk statute-PDF import (e.g. the whole BNS) ─────────────────────────

  @Post('admin/citations/import/parse')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Parse a bare-act PDF into sections (verbatim text) and return a preview to review — writes nothing',
  })
  parseStatutePdf(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: StatuteImportParseDto,
  ) {
    return this.importer.beginImport(file, {
      codePrefix: body.codePrefix,
      actName: body.actName,
      actShort: body.actShort,
      topics: body.topics,
      effectiveFrom: body.effectiveFrom,
      externalUrl: body.externalUrl || undefined,
      confidence: body.confidence,
      password: body.password,
      maxSection: body.maxSection,
    });
  }

  @Post('admin/citations/import/json')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Import citations from a JSON array (uploaded .json file or inline `json`) and preview before commit',
  })
  importStatuteJson(
    @Body() body: StatuteJsonImportDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const jsonText = file ? file.buffer.toString('utf-8') : body.json;
    if (!jsonText || !jsonText.trim()) {
      throw new BadRequestException(
        'Provide a .json file upload or a non-empty `json` field.',
      );
    }
    return this.importer.beginJsonImport(jsonText, {
      codePrefix: body.codePrefix,
      actName: body.actName,
      actShort: body.actShort,
      topics: body.topics,
      effectiveFrom: body.effectiveFrom,
      externalUrl: body.externalUrl || undefined,
      confidence: body.confidence,
    });
  }

  @Post('admin/citations/import/commit')
  @ApiOperation({
    summary:
      'Commit a reviewed statute import (by importId) into the citation catalog, in batches',
  })
  commitStatuteImport(@Body() body: StatuteImportCommitDto) {
    return this.importer.commitImport(body.importId, {
      includeIds: body.includeIds,
      overwriteExisting: body.overwriteExisting,
    });
  }

  // ── One-click fixes + AI critique ───────────────────────────────────────

  @Post('citations/document/:documentId/apply-fix')
  @ApiOperation({
    summary:
      'Apply a citation fix to a freeform document (replace-stale or insert-missing)',
  })
  applyFix(
    @CurrentUser() user: User,
    @Param('documentId') documentId: string,
    @Body() body: ApplyFixAction,
  ) {
    return this.apply.apply(user.id, documentId, body);
  }

  @Post('citations/document/:documentId/critique')
  @ApiOperation({
    summary:
      'Section-grounded AI critique of a document against its cited statutes (cached by content hash; pass ?force=1 to recompute)',
  })
  critiqueDocument(
    @CurrentUser() user: User,
    @Param('documentId') documentId: string,
    @Query('force') force?: string,
  ) {
    return this.critique.critiqueDocument(user.id, documentId, {
      force: force === '1' || force === 'true',
    });
  }

  @Post('citations/suggest-for-text')
  @ApiOperation({
    summary:
      'AI-rank applicable citations for a passage of legal text. Used by the "find a citation for this clause" UX.',
  })
  suggestForText(
    @Body()
    body: {
      text: string;
      documentTypeKey?: string;
      jurisdiction?: string;
    },
  ) {
    return this.suggester.suggestForText(body.text, {
      docTypeKey: body.documentTypeKey,
      jurisdiction: body.jurisdiction,
    });
  }
}
