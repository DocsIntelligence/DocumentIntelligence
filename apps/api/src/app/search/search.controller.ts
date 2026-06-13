import {
  Body,
  Controller,
  Get,
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
import { SearchQueryDto, UpdateSearchConfigDto } from './search.dto';
import { SearchService } from './search.service';
import { SearchConfigService } from './search-config.service';
import { SearchIndexService } from './search-index.service';

@ApiTags('search')
@Controller('search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Unified hybrid search across my documents + uploaded sources (keyword + semantic).',
  })
  run(@CurrentUser() user: User, @Query() query: SearchQueryDto) {
    return this.search.search(user.id, query);
  }
}

/**
 * Search configuration + index maintenance. Admin surface — currently open to
 * any authenticated user (mirrors IntelligenceAdminController; the role system
 * is intact, re-add `@UseGuards(RolesGuard) @Roles('admin')` to lock it).
 */
@ApiTags('search-admin')
@Controller('admin/search')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class SearchAdminController {
  constructor(
    private readonly config: SearchConfigService,
    private readonly index: SearchIndexService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Read search config (system default, or ?orgId=).' })
  getConfig(@Query('orgId') orgId?: string) {
    return this.config.getRow(orgId ?? null);
  }

  @Patch('config')
  @ApiOperation({ summary: 'Update search config (system default, or ?orgId=).' })
  updateConfig(@Body() body: UpdateSearchConfigDto, @Query('orgId') orgId?: string) {
    return this.config.update(orgId ?? null, body);
  }

  @Post('reindex')
  @ApiOperation({ summary: 'Rebuild the entire search index (backfill).' })
  reindex() {
    return this.index.backfillAll();
  }
}
