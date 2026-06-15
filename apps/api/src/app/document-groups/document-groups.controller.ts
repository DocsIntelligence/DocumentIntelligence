import {
  Body,
  Controller,
  Delete,
  Get,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AddDocumentsDto,
  CreateGroupDto,
  GroupSearchDto,
  ListGroupsQueryDto,
  PatchGroupDto,
} from './document-groups.dto';
import { DocumentGroupsService } from './document-groups.service';
import { GroupIntelligenceService } from './group-intelligence.service';

@ApiTags('document-groups')
@Controller('groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class DocumentGroupsController {
  constructor(
    private readonly groups: DocumentGroupsService,
    private readonly intel: GroupIntelligenceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my document groups' })
  list(@CurrentUser() user: User, @Query() query: ListGroupsQueryDto) {
    return this.groups.list(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a document group with its documents' })
  get(@CurrentUser() user: User, @Param('id') id: string) {
    return this.groups.getById(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new document group' })
  create(@CurrentUser() user: User, @Body() body: CreateGroupDto) {
    return this.groups.create(user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a document group' })
  patch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: PatchGroupDto,
  ) {
    return this.groups.patch(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a document group (soft)' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.groups.remove(user.id, id);
  }

  @Post(':id/documents')
  @ApiOperation({ summary: 'Add documents to a group' })
  addDocuments(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: AddDocumentsDto,
  ) {
    return this.groups.addDocuments(user.id, id, body);
  }

  @Delete(':id/documents/:documentId')
  @ApiOperation({ summary: 'Remove a document from a group' })
  removeDocument(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.groups.removeDocument(user.id, id, documentId);
  }

  @Post(':id/search')
  @ApiOperation({
    summary: 'Full-text + semantic search scoped to documents in this group',
  })
  search(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: GroupSearchDto,
  ) {
    return this.intel.searchInGroup(user.id, id, body);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Get the stored group summary (null if none generated yet)',
  })
  getSummary(@CurrentUser() user: User, @Param('id') id: string) {
    return this.intel.getStoredSummary(user.id, id);
  }

  @Post(':id/summary')
  @ApiOperation({
    summary:
      'Generate a group summary by aggregating existing per-document analysis summaries (no direct generation of any document summary)',
  })
  generateSummary(@CurrentUser() user: User, @Param('id') id: string) {
    return this.intel.generateGroupSummary(user.id, id);
  }
}
