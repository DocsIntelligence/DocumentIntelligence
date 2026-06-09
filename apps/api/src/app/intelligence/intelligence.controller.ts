import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { IntelligenceService } from './intelligence.service';

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
}
