import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { bulkCreateAssetsSchema, type User } from '@org/dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AssetDocumentService } from '../services/asset-document.service';
import { EstateDocumentAnalysisService } from '../services/estate-document-analysis.service';
import { EstateProfileService } from '../services/estate-profile.service';

type UploadedFileT = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

/** Asset documents — upload/version statements & policies, and AI extract-assist
 *  (docs/13 §2.3 / §10.1). */
@ApiTags('estate-vault')
@Controller('estate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class EstateDocumentController {
  constructor(
    private readonly docs: AssetDocumentService,
    private readonly analysis: EstateDocumentAnalysisService,
    private readonly profiles: EstateProfileService,
  ) {}

  @Post('extract')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Suggest asset fields from an uploaded statement (autofill, no asset yet)',
  })
  extract(
    @UploadedFile() file: UploadedFileT,
    @Body('password') password?: string,
    @Body('assetType') assetType?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.docs.extractFromUpload({ ...file, password, assetType });
  }

  @Post('extract-holdings')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Extract every holding from one statement (CAS) → list for bulk import',
  })
  extractHoldings(
    @UploadedFile() file: UploadedFileT,
    @Body('password') password?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.docs.extractHoldingsFromUpload({ ...file, password });
  }

  @Post('import-files')
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiOperation({
    summary:
      'Bulk import: N files (some password-protected) → auto-create one asset per file with the file attached',
  })
  async importFiles(
    @CurrentUser() user: User,
    @UploadedFiles() files: UploadedFileT[],
    @Body('passwords') passwords?: string,
    @Query('profileId') profileId?: string,
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    // `passwords` is an optional JSON array of strings aligned to file order.
    let pwds: (string | undefined)[] = [];
    if (passwords) {
      try {
        const parsed = JSON.parse(passwords);
        if (Array.isArray(parsed)) {
          pwds = parsed.map((p) => (typeof p === 'string' && p ? p : undefined));
        }
      } catch {
        throw new BadRequestException('`passwords` must be a JSON array');
      }
    }
    const profile = await this.profiles.resolve(user.id, profileId);
    return this.docs.importFiles(profile, files, pwds);
  }

  @Post('import-holdings')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Bulk-import reviewed CAS holdings AND keep the original statement (with its password) attached to every asset it produced',
  })
  async importHoldings(
    @Body('assets') assetsJson: string,
    @CurrentUser() user: User,
    @UploadedFile() file?: UploadedFileT,
    @Body('password') password?: string,
    @Query('profileId') profileId?: string,
  ) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(assetsJson ?? '');
    } catch {
      throw new BadRequestException('`assets` must be a JSON array');
    }
    const { assets } = bulkCreateAssetsSchema.parse({ assets: parsed });
    const profile = await this.profiles.resolve(user.id, profileId);
    return this.docs.bulkImportFromStatement(
      profile,
      assets,
      file,
      password?.trim() || undefined,
    );
  }

  @Get('assets/:id/documents')
  @ApiOperation({ summary: 'List an asset’s documents (versions, newest first)' })
  list(@CurrentUser() user: User, @Param('id') id: string) {
    return this.docs.listDocuments(user.id, id);
  }

  @Post('assets/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Attach a document to an asset (versioned by slot + period)' })
  add(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileT,
    @Query('kind') kind?: string,
    @Query('slotKey') slotKey?: string,
    @Query('periodAsOf') periodAsOf?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.docs.addDocument(user.id, id, file, { kind, slotKey, periodAsOf });
  }

  @Get('assets/:id/documents/:docId/url')
  @ApiOperation({ summary: 'Short-lived presigned download URL' })
  url(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.docs.documentUrl(user.id, id, docId);
  }

  @Delete('assets/:id/documents/:docId')
  @ApiOperation({ summary: 'Remove an attached document' })
  remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.docs.removeDocument(user.id, id, docId);
  }

  @Post('assets/:id/documents/:docId/extract')
  @ApiOperation({ summary: 'Suggest asset fields from an attached document' })
  extractDoc(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body('password') password?: string,
  ) {
    return this.docs.extractFromDocument(user.id, id, docId, password);
  }

  @Post('assets/:id/documents/:docId/analyze')
  @ApiOperation({
    summary: 'Analyze an attached document (summary, parties, dates, risks)',
  })
  analyzeDoc(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body('force') force?: boolean,
  ) {
    return this.analysis.analyze(user.id, id, docId, { force: !!force });
  }

  @Get('assets/:id/documents/:docId/analysis')
  @ApiOperation({ summary: 'Latest cached analysis for an attached document' })
  docAnalysis(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.analysis.latest(user.id, id, docId);
  }

  @Post('assets/:id/documents/:docId/ask')
  @ApiOperation({ summary: 'Ask a grounded question about an attached document' })
  askDoc(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body('question') question: string,
  ) {
    return this.analysis.ask(user.id, id, docId, question);
  }
}
