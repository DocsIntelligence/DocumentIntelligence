import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  UpdateExtractionSchemaDto,
  UpdatePipelineDto,
  UpsertExtractionSchemaDto,
  UpsertFieldMapDto,
  UpsertPipelineDto,
} from './intelligence-admin.dto';
import { IntelligenceAdminService } from './intelligence-admin.service';

/**
 * Admin authoring API for pipeline config-as-data (docs/07 P4.2). Admin-only;
 * mirrors the AdminController guard stack. All routes operate on the platform
 * (system) scope; an edit mints a new immutable version.
 */
@ApiTags('intelligence-admin')
@Controller('admin/intelligence')
// NOTE: temporarily open to any authenticated user (no admin gate). The role
// system is intact — re-add `@UseGuards(RolesGuard) @Roles('admin')` to lock it.
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class IntelligenceAdminController {
  constructor(private readonly admin: IntelligenceAdminService) {}

  // ─── Extraction schemas ───────────────────────────────────────────────────

  @Get('schemas')
  @ApiOperation({ summary: 'List authored extraction schemas (latest version)' })
  listSchemas() {
    return this.admin.listSchemas();
  }

  @Get('schemas/:key')
  @ApiOperation({ summary: 'Get one extraction schema with its fields' })
  getSchema(@Param('key') key: string) {
    return this.admin.getSchema(key);
  }

  @Post('schemas')
  @ApiOperation({ summary: 'Create a new extraction schema (version 1)' })
  createSchema(@Body() body: UpsertExtractionSchemaDto) {
    return this.admin.createSchema(body);
  }

  @Put('schemas/:key')
  @ApiOperation({ summary: 'Edit a schema — mints a new immutable version' })
  updateSchema(
    @Param('key') key: string,
    @Body() body: UpdateExtractionSchemaDto,
  ) {
    return this.admin.updateSchema(key, body);
  }

  @Delete('schemas/:key')
  @ApiOperation({ summary: 'Deactivate a schema (soft delete)' })
  deleteSchema(@Param('key') key: string) {
    return this.admin.deleteSchema(key);
  }

  // ─── Field-maps ─────────────────────────────────────────────────────────────

  @Get('field-maps/:schemaKey')
  @ApiOperation({ summary: 'Get the convert field-map for a schema' })
  getFieldMap(@Param('schemaKey') schemaKey: string) {
    return this.admin.getFieldMap(schemaKey);
  }

  @Put('field-maps/:schemaKey')
  @ApiOperation({ summary: 'Set a schema field-map — mints a new version' })
  upsertFieldMap(
    @Param('schemaKey') schemaKey: string,
    @Body() body: UpsertFieldMapDto,
  ) {
    return this.admin.upsertFieldMap(schemaKey, body);
  }

  // ─── Pipelines ──────────────────────────────────────────────────────────────

  @Get('pipelines')
  @ApiOperation({ summary: 'List authored pipelines (latest version)' })
  listPipelines() {
    return this.admin.listPipelines();
  }

  @Get('pipelines/:key')
  @ApiOperation({ summary: 'Get one pipeline with its ordered stages' })
  getPipeline(@Param('key') key: string) {
    return this.admin.getPipeline(key);
  }

  @Post('pipelines')
  @ApiOperation({ summary: 'Create a new pipeline (version 1)' })
  createPipeline(@Body() body: UpsertPipelineDto) {
    return this.admin.createPipeline(body);
  }

  @Put('pipelines/:key')
  @ApiOperation({ summary: 'Edit a pipeline — mints a new immutable version' })
  updatePipeline(@Param('key') key: string, @Body() body: UpdatePipelineDto) {
    return this.admin.updatePipeline(key, body);
  }

  @Delete('pipelines/:key')
  @ApiOperation({ summary: 'Deactivate a pipeline (soft delete)' })
  deletePipeline(@Param('key') key: string) {
    return this.admin.deletePipeline(key);
  }
}
