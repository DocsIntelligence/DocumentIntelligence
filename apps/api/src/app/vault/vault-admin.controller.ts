import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { VaultConfigService } from './vault-config.service';
import {
  VaultDocKindConfigDto,
  VaultEntityKindConfigDto,
  VaultEntityKindFieldsDto,
  VaultFieldConfigDto,
} from './vault-admin.dto';

/**
 * Admin config for the vault catalog (docs/10): entity kinds, the global
 * field pool, the entity-kind → field links, and document kinds. `?orgId=`
 * targets an org's overrides; omit for the system defaults.
 */
@ApiTags('vault-admin')
@Controller('admin/vault')
@UseGuards(RolesGuard)
@Roles('admin')
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class VaultAdminController {
  constructor(private readonly config: VaultConfigService) {}

  // ── Entity kinds ──────────────────────────────────────────────────────

  @Get('entity-kinds')
  @ApiOperation({ summary: 'List configured entity kinds (system or ?orgId=)' })
  listEntityKinds(@Query('orgId') orgId?: string) {
    return this.config.listEntityKinds(orgId ?? null);
  }

  @Post('entity-kinds')
  @ApiOperation({ summary: 'Create or update an entity kind' })
  upsertEntityKind(
    @Body() body: VaultEntityKindConfigDto,
    @Query('orgId') orgId?: string,
  ) {
    return this.config.upsertEntityKind(orgId ?? null, body);
  }

  @Delete('entity-kinds/:id')
  @ApiOperation({ summary: 'Delete an entity kind (non-system only)' })
  deleteEntityKind(@Param('id') id: string) {
    return this.config.deleteEntityKind(id);
  }

  @Get('entity-kinds/:id/fields')
  @ApiOperation({ summary: 'List the field links for an entity kind' })
  listEntityKindFields(@Param('id') id: string) {
    return this.config.listEntityKindFields(id);
  }

  @Put('entity-kinds/:id/fields')
  @ApiOperation({ summary: 'Replace the field-link set for an entity kind' })
  setEntityKindFields(
    @Param('id') id: string,
    @Body() body: VaultEntityKindFieldsDto,
  ) {
    return this.config.setEntityKindFields(id, body.links);
  }

  // ── Field pool ────────────────────────────────────────────────────────

  @Get('fields')
  @ApiOperation({ summary: 'List configured vault fields (system or ?orgId=)' })
  listFields(@Query('orgId') orgId?: string) {
    return this.config.listFields(orgId ?? null);
  }

  @Post('fields')
  @ApiOperation({ summary: 'Create or update a vault field' })
  upsertField(@Body() body: VaultFieldConfigDto, @Query('orgId') orgId?: string) {
    return this.config.upsertField(orgId ?? null, body);
  }

  @Delete('fields/:id')
  @ApiOperation({ summary: 'Delete a vault field' })
  deleteField(@Param('id') id: string) {
    return this.config.deleteField(id);
  }

  // ── Document kinds ────────────────────────────────────────────────────

  @Get('doc-kinds')
  @ApiOperation({ summary: 'List configured document kinds' })
  listDocKinds(@Query('orgId') orgId?: string) {
    return this.config.listDocKinds(orgId ?? null);
  }

  @Post('doc-kinds')
  @ApiOperation({ summary: 'Create or update a document kind' })
  upsertDocKind(@Body() body: VaultDocKindConfigDto, @Query('orgId') orgId?: string) {
    return this.config.upsertDocKind(orgId ?? null, body);
  }

  @Delete('doc-kinds/:id')
  @ApiOperation({ summary: 'Delete a document kind' })
  deleteDocKind(@Param('id') id: string) {
    return this.config.deleteDocKind(id);
  }
}
