import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ExtractionEngineMode } from '@prisma/client';
import type {} from 'multer';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ArchiveRunDto,
  ArchiveTypeDto,
  AskDto,
  BulkArchiveDto,
  ListBatchesQueryDto,
  ListRunsQueryDto,
  PresignUploadDto,
  RegisterSourceDto,
  ReprocessDto,
  SaveReviewDto,
} from './intelligence.dto';
import { AnalysisService } from './analysis.service';
import { AnalysisQueueService } from './analysis-queue.service';
import { BatchService } from './batch.service';
import { IntelligenceService } from './intelligence.service';
import { PipelineExecutorService } from './pipeline-executor.service';

/** Coerce a query-string engine value to the enum; unknown/empty → auto. */
function parseEngineMode(value?: string): ExtractionEngineMode {
  return value && value in ExtractionEngineMode
    ? (value as ExtractionEngineMode)
    : ExtractionEngineMode.auto;
}

/**
 * Document Intelligence API (docs/05). Upload an existing document → it is
 * classified + extracted asynchronously → poll the job → read / correct the
 * extraction. The Phase-3 convert bridge (structured prefill / freeform) is a
 * separate endpoint added later; nothing here edits Document/editor code.
 */
@ApiTags('intelligence')
@Controller('intelligence')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class IntelligenceController {
  constructor(
    private readonly intelligence: IntelligenceService,
    private readonly analysis: AnalysisService,
    private readonly analysisQueue: AnalysisQueueService,
    private readonly pipelines: PipelineExecutorService,
    private readonly batches: BatchService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a document and start extraction' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Query('ownerOrgId') ownerOrgId?: string,
    @Query('engine') engine?: string,
  ) {
    return this.intelligence.uploadAndStart(
      user.id,
      file,
      ownerOrgId || undefined,
      parseEngineMode(engine),
    );
  }

  @Post('presign')
  @ApiOperation({ summary: 'Get a presigned URL for direct-to-S3 upload' })
  presign(@CurrentUser() user: User, @Body() body: PresignUploadDto) {
    return this.intelligence.presignUpload(user.id, body);
  }

  @Post('sources')
  @ApiOperation({
    summary: 'Register a presigned-uploaded file and start extraction',
  })
  register(@CurrentUser() user: User, @Body() body: RegisterSourceDto) {
    return this.intelligence.registerAndStart(user.id, body);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Poll an extraction job' })
  getJob(@CurrentUser() user: User, @Param('id') id: string) {
    return this.intelligence.getJob(user.id, id);
  }

  @Get('sources/:id/extraction')
  @ApiOperation({
    summary: 'Get the latest extraction (fields + confidence + review decision)',
  })
  getExtraction(@CurrentUser() user: User, @Param('id') id: string) {
    return this.intelligence.getExtraction(user.id, id);
  }

  @Get('sources/:id/original-url')
  @ApiOperation({
    summary: 'Presigned download URL for the original uploaded file',
  })
  getOriginalUrl(@CurrentUser() user: User, @Param('id') id: string) {
    return this.intelligence.getOriginalUrl(user.id, id);
  }

  @Post('extractions/:id/review')
  @ApiOperation({ summary: 'Save reviewed/corrected extraction values' })
  saveReview(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: SaveReviewDto,
  ) {
    return this.intelligence.saveReview(user.id, id, body);
  }

  @Post('extractions/:id/convert')
  @ApiOperation({
    summary:
      'Create an editable Document from a reviewed extraction (structured prefill or freeform).',
  })
  convert(@CurrentUser() user: User, @Param('id') id: string) {
    return this.intelligence.convert(user.id, id);
  }

  @Post('sources/:id/analyze')
  @ApiOperation({
    summary:
      'Analyse a document: summary, parties, obligations, key dates, risk flags + cited-law health.',
  })
  analyze(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.analysis.analyze(user.id, id, { force: force === 'true' });
  }

  @Get('sources/:id/analysis')
  @ApiOperation({ summary: 'Get the latest analysis for a document' })
  getAnalysis(@CurrentUser() user: User, @Param('id') id: string) {
    return this.analysis.getLatestAnalysis(user.id, id);
  }

  @Post('sources/:id/ask')
  @ApiOperation({
    summary: 'Ask a question about a document (RAG, page-cited answer)',
  })
  ask(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: AskDto,
  ) {
    return this.analysis.ask(user.id, id, body.question);
  }

  // ─── Analyse / ask on a DRAFTING document (docs/09 #6) ────────────────────

  @Post('documents/:id/analyze')
  @ApiOperation({ summary: 'Analyse a drafting document (cached by content).' })
  analyzeDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('force') force?: string,
  ) {
    return this.analysis.analyzeDocument(user.id, id, {
      force: force === 'true',
    });
  }

  @Post('documents/analyze-status')
  @ApiOperation({
    summary:
      'Batched analysis status for a set of drafting documents (one round-trip; powers the documents-list status column).',
  })
  documentsAnalysisStatus(
    @CurrentUser() user: User,
    @Body() body: { documentIds: string[] },
  ) {
    const ids = Array.isArray(body?.documentIds) ? body.documentIds : [];
    return this.analysis.getDocumentsAnalysisStatus(user.id, ids);
  }

  // ─── Analysis queue (bulk + background) ────────────────────────────────────

  @Post('analysis-queue')
  @ApiOperation({
    summary:
      'Enqueue a batch of documents for background analysis. Returns the batchId + initial item rows.',
  })
  enqueueAnalysisBatch(
    @CurrentUser() user: User,
    @Body() body: { documentIds: string[]; force?: boolean },
  ) {
    const ids = Array.isArray(body?.documentIds) ? body.documentIds : [];
    return this.analysisQueue.enqueueBatch(user.id, ids, {
      force: !!body?.force,
    });
  }

  @Get('analysis-queue/active')
  @ApiOperation({
    summary:
      'Recent batches with in-flight work (or finished in the last 60s) — powers the queue indicator.',
  })
  getActiveAnalysisQueue(@CurrentUser() user: User) {
    return this.analysisQueue.getActive(user.id);
  }

  @Get('analysis-queue/:batchId')
  @ApiOperation({ summary: 'Poll a single batch (items + counts)' })
  getAnalysisQueueBatch(
    @CurrentUser() user: User,
    @Param('batchId') batchId: string,
  ) {
    return this.analysisQueue.getBatch(user.id, batchId);
  }

  @Get('documents/:id/analysis')
  @ApiOperation({ summary: 'Get the latest analysis for a drafting document.' })
  getDocumentAnalysis(@CurrentUser() user: User, @Param('id') id: string) {
    return this.analysis.getLatestDocumentAnalysis(user.id, id);
  }

  @Post('documents/:id/ask')
  @ApiOperation({ summary: 'Ask a question about a drafting document (RAG).' })
  askDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: AskDto,
  ) {
    return this.analysis.askDocument(user.id, id, body.question);
  }

  // ─── Pipeline engine (docs/07 P4.1) ───────────────────────────────────────

  @Post('sources/:id/run-pipeline')
  @ApiOperation({
    summary:
      'Run a document through a configurable pipeline (classify → extract → validate → export).',
  })
  runPipeline(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('pipeline') pipelineKey?: string,
  ) {
    return this.pipelines.startRun(user.id, id, pipelineKey || undefined);
  }

  @Get('pipelines')
  @ApiOperation({ summary: 'List pipelines available to run (key + name)' })
  listPipelines() {
    return this.pipelines.listAvailablePipelines();
  }

  @Get('pipeline-runs/:id')
  @ApiOperation({ summary: 'Poll a pipeline run (per-stage status)' })
  getPipelineRun(@CurrentUser() user: User, @Param('id') id: string) {
    return this.pipelines.getRun(user.id, id);
  }

  // ─── Batches (docs/07 P4.3) ────────────────────────────────────────────────

  @Post('batches')
  @UseInterceptors(FilesInterceptor('files', 1000))
  @ApiOperation({ summary: 'Upload many documents as a batch and run a pipeline' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  createBatch(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: User,
    @Query('pipeline') pipelineKey?: string,
    @Query('name') name?: string,
  ) {
    return this.batches.createMultiFileBatch(user.id, files, {
      pipelineKey: pipelineKey || undefined,
      name: name || undefined,
    });
  }

  @Get('batches')
  @ApiOperation({ summary: 'List my batches with progress counts' })
  listBatches(
    @CurrentUser() user: User,
    @Query() query: ListBatchesQueryDto,
  ) {
    return this.batches.list(user.id, query);
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get a batch summary (funnel + type histogram)' })
  getBatch(@CurrentUser() user: User, @Param('id') id: string) {
    return this.batches.get(user.id, id);
  }

  @Get('batches/:id/runs')
  @ApiOperation({ summary: 'A page of a batch’s runs (server-side, docs/09 #9)' })
  listBatchRuns(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query() query: ListRunsQueryDto,
  ) {
    return this.batches.listRuns(user.id, id, query);
  }

  @Post('batches/:id/archive-type')
  @ApiOperation({ summary: 'Skip (archive) all archivable runs of a type' })
  archiveType(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: ArchiveTypeDto,
  ) {
    return this.pipelines.bulkArchiveByType(
      user.id,
      id,
      body.documentTypeKey,
      body.reason,
    );
  }

  // ─── Review queue (docs/07 P4.4) ───────────────────────────────────────────

  @Get('review-queue')
  @ApiOperation({ summary: 'Pipeline runs awaiting human review (paginated)' })
  reviewQueue(
    @CurrentUser() user: User,
    @Query('batch') batchId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pipelines.reviewQueue(
      user.id,
      batchId,
      page ? Number(page) : 0,
      pageSize ? Number(pageSize) : 50,
    );
  }

  @Post('pipeline-runs/:id/approve')
  @ApiOperation({
    summary: 'Approve a parked run — finalize (export) with the reviewed values',
  })
  approveRun(@CurrentUser() user: User, @Param('id') id: string) {
    return this.pipelines.approveRun(user.id, id);
  }

  @Post('pipeline-runs/:id/archive')
  @ApiOperation({ summary: 'Archive (skip) a run — no extraction' })
  archiveRun(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: ArchiveRunDto,
  ) {
    return this.pipelines.archiveRun(user.id, id, body.reason);
  }

  @Post('runs/archive')
  @ApiOperation({ summary: 'Bulk-archive runs (e.g. skip all of a type)' })
  bulkArchive(@CurrentUser() user: User, @Body() body: BulkArchiveDto) {
    return this.pipelines.bulkArchive(user.id, body.runIds, body.reason);
  }

  // ─── Manual type override ──────────────────────────────────────────────────

  @Get('schemas')
  @ApiOperation({ summary: 'Active extraction types the user can pick from' })
  listSchemas(
    @CurrentUser() _user: User,
    @Query('ownerOrgId') ownerOrgId?: string,
  ) {
    return this.intelligence.listSchemas(ownerOrgId || null);
  }

  @Post('sources/:id/reprocess')
  @ApiOperation({
    summary: 'Re-extract a source as a chosen type (manual override)',
  })
  reprocess(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: ReprocessDto,
  ) {
    return this.pipelines.reprocess(user.id, id, body.schemaKey);
  }
}
