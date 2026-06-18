import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EstateVaultConfigService } from '../services/estate-vault-config.service';
import { ReleaseService } from '../services/release.service';
import { UpdateEstateVaultConfigDto } from '../dto/estate.dto';

/**
 * Admin config for the estate-vault module (docs/13 §0.3): the asset-type
 * catalog, liveness cadence, proof requirements, and sub-surface toggles —
 * config-as-data, editable without a redeploy. `?orgId=` targets an org's
 * overrides; omit for the system defaults. Open to any authenticated user for
 * now (mirrors the other admin surfaces; re-add a RolesGuard to lock it).
 */
@ApiTags('estate-vault-admin')
@Controller('admin/estate-vault')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class EstateAdminController {
  constructor(
    private readonly config: EstateVaultConfigService,
    private readonly release: ReleaseService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Resolved module config (org override → system)' })
  getConfig(@Query('orgId') orgId?: string) {
    return this.config.resolve(orgId ?? null);
  }

  @Put('config')
  @ApiOperation({ summary: 'Update the module config (partial merge)' })
  updateConfig(
    @Body() body: UpdateEstateVaultConfigDto,
    @Query('orgId') orgId?: string,
  ) {
    return this.config.update(orgId ?? null, body);
  }

  @Get('grants')
  @ApiOperation({ summary: 'All release grants (ops view for verification)' })
  listGrants() {
    return this.release.listAllForAdmin();
  }

  @Get('grants/:id/proof/:index')
  @ApiOperation({ summary: 'Presigned URL for a submitted proof file (verification)' })
  proofUrl(@Param('id') id: string, @Param('index') index: string) {
    return this.release.proofUrl(id, Number(index));
  }

  @Post('grants/:id/release')
  @ApiOperation({
    summary:
      'Human-verified release: unlock the nominee’s read-only view (after proof of death).',
  })
  releaseGrant(@Param('id') id: string) {
    return this.release.release(id);
  }
}
