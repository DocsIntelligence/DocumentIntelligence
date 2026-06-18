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
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateVaultEntityDto,
  ListVaultEntitiesQueryDto,
  UpdateVaultEntityDto,
} from './vault.dto';
import { VaultService } from './vault.service';
import { VaultConfigService } from './vault-config.service';

/** Document Vault (docs/10): entities + their documents, encrypted + owner-scoped. */
@ApiTags('vault')
@Controller('vault')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class VaultController {
  constructor(
    private readonly vault: VaultService,
    private readonly config: VaultConfigService,
  ) {}

  @Get('entity-kinds')
  @ApiOperation({
    summary: 'List active entity kinds (drives the create-entity picker)',
  })
  entityKinds() {
    // For now we expose the system rows directly; org-scoped overrides
    // would resolve here once we surface orgId on the user principal.
    return this.config.listEntityKindsActive(null);
  }

  @Get('entities')
  @ApiOperation({ summary: 'List my vault entities, paginated (fields masked)' })
  list(@CurrentUser() user: User, @Query() query: ListVaultEntitiesQueryDto) {
    return this.vault.list(user.id, query);
  }

  @Post('entities')
  @ApiOperation({ summary: 'Create a vault entity' })
  create(@CurrentUser() user: User, @Body() body: CreateVaultEntityDto) {
    return this.vault.create(user.id, body);
  }

  @Get('entities/:id')
  @ApiOperation({ summary: 'Get an entity (sensitive fields masked) + its documents' })
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.vault.get(user.id, id);
  }

  @Get('entities/:id/reveal')
  @ApiOperation({ summary: 'Get the entity with UNMASKED fields (audited)' })
  reveal(@CurrentUser() user: User, @Param('id') id: string) {
    return this.vault.reveal(user.id, id);
  }

  @Get('entities/:id/autofill')
  @ApiOperation({ summary: 'Decrypted canonical fields for document autofill (audited)' })
  autofill(@CurrentUser() user: User, @Param('id') id: string) {
    return this.vault.autofill(user.id, id);
  }

  @Patch('entities/:id')
  @ApiOperation({ summary: 'Update an entity (label and/or fields)' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateVaultEntityDto,
  ) {
    return this.vault.update(user.id, id, body);
  }

  @Post('entities/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate an entity (fields cloned; documents not)' })
  duplicate(@CurrentUser() user: User, @Param('id') id: string) {
    return this.vault.duplicate(user.id, id);
  }

  @Delete('entities/:id')
  @ApiOperation({ summary: 'Delete an entity (and purge its documents)' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.vault.remove(user.id, id);
  }

  @Post('entities/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Attach an original document (Aadhaar/PAN/… scan)' })
  addDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('kind') kind?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.vault.addDocument(user.id, id, file, kind ?? 'other');
  }

  @Post('entities/:id/documents/bulk-scan')
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiOperation({
    summary:
      'Upload many KYC docs → classify + extract + attach each, then autofill the entity',
  })
  bulkScan(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('No files uploaded');
    return this.vault.bulkIngest(user.id, id, files);
  }

  @Post('entities/:id/documents/:docId/scan')
  @ApiOperation({ summary: 'Vision-scan a document → suggested field values (audited)' })
  scanDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.vault.scanDocument(user.id, id, docId);
  }

  @Get('entities/:id/documents/:docId/url')
  @ApiOperation({ summary: 'Short-lived presigned download URL (audited)' })
  documentUrl(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.vault.documentUrl(user.id, id, docId);
  }

  @Delete('entities/:id/documents/:docId')
  @ApiOperation({ summary: 'Remove an attached document' })
  removeDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
  ) {
    return this.vault.removeDocument(user.id, id, docId);
  }
}
