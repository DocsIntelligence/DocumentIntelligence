import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VaultConfigService } from './vault-config.service';
import { VaultDocKindConfigDto, VaultFieldConfigDto } from './vault-admin.dto';

/**
 * Admin config for the vault catalog (docs/10): the field catalog per entity
 * kind + the document kinds. `?orgId=` targets an org's overrides; omit for the
 * system defaults. Open to any authenticated user for now (mirrors the other
 * admin surfaces; re-add a RolesGuard to lock it).
 */
@ApiTags('vault-admin')
@Controller('admin/vault')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class VaultAdminController {
  constructor(private readonly config: VaultConfigService) {}

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
