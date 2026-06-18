import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { User } from '@org/dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AssetService } from '../services/asset.service';
import { EstateVaultConfigService } from '../services/estate-vault-config.service';
import { EstateProfileService } from '../services/estate-profile.service';
import { EstateReportService } from '../services/estate-report.service';
import { EstateSearchService } from '../services/estate-search.service';
import { EstateReportPdfService } from '../services/estate-report-pdf.service';
import { GapService } from '../services/gap.service';
import { NomineeService } from '../services/nominee.service';
import { PortfolioAnalysisService } from '../services/portfolio-analysis.service';
import { ReleaseService } from '../services/release.service';
import {
  BulkCreateAssetsDto,
  CreateAssetDto,
  CreateNomineeDto,
  CreateEstateProfileDto,
  UpdateEstateProfileDto,
  ListAssetsQueryDto,
  RecordValuationDto,
  SetNominationsDto,
  ShareEstateProfileDto,
  UpdateAssetDto,
  UpdateNomineeDto,
  UpdateReleasePlanDto,
  VaultSearchQueryDto,
} from '../dto/estate.dto';

/** Estate & Wealth Vault (docs/13): asset inventory, valuations, net worth. */
@ApiTags('estate-vault')
@Controller('estate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class EstateController {
  constructor(
    private readonly assets: AssetService,
    private readonly config: EstateVaultConfigService,
    private readonly nominees: NomineeService,
    private readonly release: ReleaseService,
    private readonly report: EstateReportService,
    private readonly reportPdf: EstateReportPdfService,
    private readonly gaps: GapService,
    private readonly portfolio: PortfolioAnalysisService,
    private readonly search: EstateSearchService,
    private readonly profiles: EstateProfileService,
  ) {}

  // ── Profiles (managed person-vaults) ───────────────────────────────────────

  @Get('profiles')
  @ApiOperation({ summary: 'Managed person-vaults I own or can access' })
  listProfiles(@CurrentUser() user: User) {
    return this.profiles.list(user.id);
  }

  @Post('profiles')
  @ApiOperation({ summary: 'Create a managed profile (link/mint a Vault person)' })
  createProfile(@CurrentUser() user: User, @Body() body: CreateEstateProfileDto) {
    return this.profiles.create(user.id, body);
  }

  @Patch('profiles/:id')
  @ApiOperation({ summary: 'Update a profile (label / amount-masking)' })
  updateProfile(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateEstateProfileDto,
  ) {
    return this.profiles.update(user.id, id, body);
  }

  @Delete('profiles/:id')
  @ApiOperation({ summary: 'Delete a managed profile (must be empty, not self)' })
  removeProfile(@CurrentUser() user: User, @Param('id') id: string) {
    return this.profiles.remove(user.id, id);
  }

  @Get('profiles/:id/access')
  @ApiOperation({ summary: 'Who else can access this profile' })
  listAccess(@CurrentUser() user: User, @Param('id') id: string) {
    return this.profiles.listAccess(user.id, id);
  }

  @Post('profiles/:id/share')
  @ApiOperation({ summary: 'Share a profile with another account (wealth manager)' })
  share(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: ShareEstateProfileDto,
  ) {
    return this.profiles.share(user.id, id, body.email, body.role);
  }

  @Delete('profiles/:id/access/:userId')
  @ApiOperation({ summary: 'Revoke another account’s access to a profile' })
  unshare(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.profiles.unshare(user.id, id, targetUserId);
  }

  @Get('capability')
  @ApiOperation({
    summary:
      'Module capability + resolved config summary (drives frontend gating).',
  })
  async capability() {
    const cfg = await this.config.resolve(null);
    return {
      enabled: cfg.enabled,
      baseCurrency: cfg.baseCurrency,
      toggles: cfg.toggles,
      assetTypes: cfg.assetTypes.filter((t) => t.isActive),
    };
  }

  @Get('asset-types')
  @ApiOperation({ summary: 'Active asset types (drives the add-asset picker)' })
  assetTypes() {
    return this.config.assetTypes(null);
  }

  @Get('networth')
  @ApiOperation({ summary: 'Current net worth + breakdown by asset type' })
  async netWorth(@CurrentUser() user: User, @Query('profileId') profileId?: string) {
    return this.assets.netWorth(await this.profiles.resolve(user.id, profileId));
  }

  @Get('networth/history')
  @ApiOperation({ summary: 'Net-worth-over-time snapshots (time-machine)' })
  async netWorthHistory(@CurrentUser() user: User, @Query('profileId') profileId?: string) {
    return this.assets.netWorthHistory(
      await this.profiles.resolve(user.id, profileId),
    );
  }

  @Post('portfolio/analyze')
  @ApiOperation({
    summary: 'AI wealth analysis of the whole portfolio (concentration, gaps, risks)',
  })
  async analyzePortfolio(
    @CurrentUser() user: User,
    @Query('profileId') profileId?: string,
  ) {
    return this.portfolio.analyze(
      await this.profiles.resolve(user.id, profileId),
    );
  }

  @Get('search')
  @ApiOperation({
    summary:
      'Vault-wide search across asset fields, attached-document text and AI analysis',
  })
  async searchVault(
    @CurrentUser() user: User,
    @Query() query: VaultSearchQueryDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.search.search(
      await this.profiles.resolve(user.id, profileId),
      query.q,
      query.limit,
    );
  }

  @Get('assets')
  @ApiOperation({ summary: 'List my assets, paginated/sorted/filtered' })
  async list(
    @CurrentUser() user: User,
    @Query() query: ListAssetsQueryDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.list(await this.profiles.resolve(user.id, profileId), query);
  }

  @Post('assets')
  @ApiOperation({ summary: 'Add an asset (identifier stored encrypted)' })
  async create(
    @CurrentUser() user: User,
    @Body() body: CreateAssetDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.create(await this.profiles.resolve(user.id, profileId), body);
  }

  @Post('assets/bulk')
  @ApiOperation({ summary: 'Bulk-create assets (e.g. holdings from one CAS)' })
  async bulkCreate(
    @CurrentUser() user: User,
    @Body() body: BulkCreateAssetsDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.bulkCreate(
      await this.profiles.resolve(user.id, profileId),
      body.assets,
    );
  }

  @Get('assets/:id')
  @ApiOperation({ summary: 'Get one asset (identifier masked)' })
  async get(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.get(await this.profiles.resolve(user.id, profileId), id);
  }

  @Get('assets/:id/reveal')
  @ApiOperation({ summary: 'Get the unmasked identifier/notes (decrypted)' })
  async reveal(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.reveal(await this.profiles.resolve(user.id, profileId), id);
  }

  @Patch('assets/:id')
  @ApiOperation({ summary: 'Update an asset (a new value appends a valuation)' })
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateAssetDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.update(
      await this.profiles.resolve(user.id, profileId),
      id,
      body,
    );
  }

  @Delete('assets/:id')
  @ApiOperation({ summary: 'Remove an asset (soft delete; history preserved)' })
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.remove(await this.profiles.resolve(user.id, profileId), id);
  }

  @Post('assets/:id/valuations')
  @ApiOperation({ summary: 'Append a valuation snapshot (history)' })
  async recordValuation(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: RecordValuationDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.recordValuation(
      await this.profiles.resolve(user.id, profileId),
      id,
      body,
    );
  }

  @Get('assets/:id/valuations')
  @ApiOperation({ summary: 'Value-over-time for one asset (time-machine)' })
  async valuations(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.assets.valuations(
      await this.profiles.resolve(user.id, profileId),
      id,
    );
  }

  // ── Nominees + per-asset nominations (M5) ──────────────────────────────────

  @Get('nominees')
  @ApiOperation({ summary: 'List my nominees' })
  async listNominees(@CurrentUser() user: User, @Query('profileId') profileId?: string) {
    return this.nominees.list(await this.profiles.resolve(user.id, profileId));
  }

  @Post('nominees')
  @ApiOperation({ summary: 'Add a nominee (creates a release grant + invite)' })
  async createNominee(
    @CurrentUser() user: User,
    @Body() body: CreateNomineeDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.nominees.create(await this.profiles.resolve(user.id, profileId), body);
  }

  @Get('nominees/:id/reveal')
  @ApiOperation({ summary: 'Reveal a nominee’s unmasked KYC (phone/Aadhaar/PAN/address)' })
  async revealNominee(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.nominees.reveal(await this.profiles.resolve(user.id, profileId), id);
  }

  @Patch('nominees/:id')
  @ApiOperation({ summary: 'Update a nominee' })
  async updateNominee(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: UpdateNomineeDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.nominees.update(
      await this.profiles.resolve(user.id, profileId),
      id,
      body,
    );
  }

  @Delete('nominees/:id')
  @ApiOperation({ summary: 'Remove a nominee' })
  async removeNominee(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.nominees.remove(await this.profiles.resolve(user.id, profileId), id);
  }

  @Get('assets/:id/nominations')
  @ApiOperation({ summary: 'Nominees designated for an asset' })
  async listNominations(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.nominees.listNominations(
      await this.profiles.resolve(user.id, profileId),
      id,
    );
  }

  @Put('assets/:id/nominations')
  @ApiOperation({ summary: 'Replace the nominee set for an asset (≤4)' })
  async setNominations(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: SetNominationsDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.nominees.setNominations(
      await this.profiles.resolve(user.id, profileId),
      id,
      body,
    );
  }

  // ── Release / dead-man-switch (M5) ─────────────────────────────────────────

  @Get('release')
  @ApiOperation({ summary: 'My release grants + liveness status' })
  async listGrants(@CurrentUser() user: User, @Query('profileId') profileId?: string) {
    return this.release.listGrants(await this.profiles.resolve(user.id, profileId));
  }

  @Post('checkin')
  @ApiOperation({ summary: "I'm here — reset the liveness timer" })
  async checkIn(@CurrentUser() user: User, @Query('profileId') profileId?: string) {
    return this.release.checkIn(await this.profiles.resolve(user.id, profileId));
  }

  @Patch('release/:nomineeId')
  @ApiOperation({ summary: 'Update a nominee’s release plan (cadence/scope)' })
  async updatePlan(
    @CurrentUser() user: User,
    @Param('nomineeId') nomineeId: string,
    @Body() body: UpdateReleasePlanDto,
    @Query('profileId') profileId?: string,
  ) {
    return this.release.updatePlan(
      await this.profiles.resolve(user.id, profileId),
      nomineeId,
      body,
    );
  }

  @Post('release/:nomineeId/revoke')
  @ApiOperation({ summary: 'Revoke a nominee’s grant' })
  async revoke(
    @CurrentUser() user: User,
    @Param('nomineeId') nomineeId: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.release.revoke(
      await this.profiles.resolve(user.id, profileId),
      nomineeId,
    );
  }

  // ── Estate Report (owner preview) ──────────────────────────────────────────

  @Get('report')
  @ApiOperation({ summary: 'My Estate Report preview (identifiers masked)' })
  async report_(@CurrentUser() user: User, @Query('profileId') profileId?: string) {
    return this.report.ownerReport(await this.profiles.resolve(user.id, profileId));
  }

  @Get('report.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="estate-report.pdf"')
  @ApiOperation({ summary: 'My Estate Report as a rendered PDF (identifiers masked)' })
  async reportPdfDownload(
    @CurrentUser() user: User,
    @Res() res: Response,
    @Query('profileId') profileId?: string,
  ) {
    const profile = await this.profiles.resolve(user.id, profileId);
    const pdf = await this.reportPdf.ownerReportPdf(profile);
    res.end(pdf);
  }

  @Get('nudges')
  @ApiOperation({ summary: 'Operational gap nudges (no-nominee/value/stale/dormant)' })
  async nudges(@CurrentUser() user: User, @Query('profileId') profileId?: string) {
    return this.gaps.nudges(await this.profiles.resolve(user.id, profileId));
  }
}
