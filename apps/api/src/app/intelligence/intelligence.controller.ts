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
  AskDto,
  PresignUploadDto,
  RegisterSourceDto,
  SaveReviewDto,
} from './intelligence.dto';
import { AnalysisService } from './analysis.service';
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
  analyze(@CurrentUser() user: User, @Param('id') id: string) {
    return this.analysis.analyze(user.id, id);
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
  listBatches(@CurrentUser() user: User) {
    return this.batches.list(user.id);
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Get a batch with its runs' })
  getBatch(@CurrentUser() user: User, @Param('id') id: string) {
    return this.batches.get(user.id, id);
  }

  // ─── Review queue (docs/07 P4.4) ───────────────────────────────────────────

  @Get('review-queue')
  @ApiOperation({ summary: 'Pipeline runs awaiting human review' })
  reviewQueue(@CurrentUser() user: User) {
    return this.pipelines.reviewQueue(user.id);
  }

  @Post('pipeline-runs/:id/approve')
  @ApiOperation({
    summary: 'Approve a parked run — finalize (export) with the reviewed values',
  })
  approveRun(@CurrentUser() user: User, @Param('id') id: string) {
    return this.pipelines.approveRun(user.id, id);
  }
}
