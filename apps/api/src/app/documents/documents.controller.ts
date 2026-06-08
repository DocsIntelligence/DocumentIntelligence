import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';
import {
  CreateDocumentDto,
  ListDocumentsQueryDto,
  PatchDocumentDto,
} from './documents.dto';
import { DocumentsService } from './documents.service';
import { CreateExportDto } from './exports/exports.dto';
import { ExportsService } from './exports/exports.service';

@ApiTags('documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly exports: ExportsService,
    private readonly storage: StorageService,
  ) {}

  @Get('catalog')
  @Public()
  @ApiOperation({ summary: 'List available document types and templates' })
  catalog() {
    return this.documents.listTypes();
  }

  @Get(':id/render-payload')
  @Public()
  @ApiOperation({
    summary:
      'Internal render payload — consumed by the artboard /render route via x-render-token. NOT a user-facing endpoint.',
  })
  renderPayload(
    @Param('id') id: string,
    @Headers('x-render-token') token: string,
  ) {
    return this.documents.renderPayload(id, token);
  }

  @Get()
  @ApiOperation({ summary: 'List my documents (and my orgs documents)' })
  list(@CurrentUser() user: User, @Query() query: ListDocumentsQueryDto) {
    return this.documents.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single document by id' })
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.documents.getById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new document' })
  create(@CurrentUser() user: User, @Body() body: CreateDocumentDto) {
    return this.documents.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch a document (autosave)' })
  patch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: PatchDocumentDto,
  ) {
    return this.documents.patch(user.id, id, body);
  }

  @Post(':id/snapshot')
  @ApiOperation({ summary: 'Create a DocumentVersion snapshot' })
  snapshot(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { label?: string },
  ) {
    return this.documents.snapshot(user.id, id, body?.label);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List version snapshots for a document' })
  listVersions(@CurrentUser() user: User, @Param('id') id: string) {
    return this.documents.listVersions(user.id, id);
  }

  @Post(':id/versions/:versionId/restore')
  @ApiOperation({ summary: 'Restore a document to a previous version' })
  restoreVersion(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documents.restoreVersion(user.id, id, versionId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.documents.remove(user.id, id);
  }

  @Post(':id/exports')
  @ApiOperation({ summary: 'Enqueue a PDF export job for this document' })
  enqueueExport(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: CreateExportDto,
  ) {
    return this.exports.enqueueExport(user.id, id, body.pageSize);
  }

  @Get(':id/exports/:exportId')
  @ApiOperation({ summary: 'Get the status of a PDF export job' })
  getExport(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('exportId') exportId: string,
  ) {
    return this.exports.getExport(user.id, id, exportId);
  }

  @Get(':id/exports/:exportId/download')
  @ApiOperation({
    summary: 'Get a short-lived presigned URL to download a ready PDF export.',
  })
  async getExportDownload(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('exportId') exportId: string,
  ) {
    const exp = await this.exports.getExport(user.id, id, exportId);
    if (exp.status !== 'ready' || !exp.s3Key) {
      return { ready: false as const, status: exp.status, error: exp.error };
    }
    const url = await this.storage.getPresignedDownloadUrl(exp.s3Key);
    return {
      ready: true as const,
      url,
      byteSize: exp.byteSize,
      pageSize: exp.pageSize,
    };
  }
}
