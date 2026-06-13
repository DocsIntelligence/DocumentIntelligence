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
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LookupService } from './lookup.service';

/**
 * Lookups: public reads (GET / and GET :key) + management endpoints.
 *
 * The management endpoints are open to any AUTHENTICATED user for now, to match
 * the rest of the admin config UI (Document types / Pipelines — same policy).
 * The role system is intact — re-add `@UseGuards(RolesGuard) @Roles('admin')`
 * on the write/admin methods to lock it down.
 */
@ApiTags('lookups')
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('lookups')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all public lookup groups' })
  getAll() {
    return this.lookupService.getAllPublic();
  }

  // Declared BEFORE `:key` so the literal segment wins over the param route.
  @Get('admin')
  @ApiOperation({
    summary: 'Get lookup groups (paginated) incl. non-public + inactive values',
  })
  getAllAdmin(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.lookupService.getAllPaginated({
      q: q?.trim() || undefined,
      page: page ? Math.max(0, Number(page)) : 0,
      pageSize: pageSize ? Math.min(100, Math.max(1, Number(pageSize))) : 50,
    });
  }

  @Get('admin/:id')
  @ApiOperation({ summary: 'Get one lookup group WITH its values (admin)' })
  getOneAdmin(@Param('id') id: string) {
    return this.lookupService.getOneAdmin(id);
  }

  @Public()
  @Get(':key')
  @ApiOperation({ summary: 'Get a lookup group by key' })
  getByKey(@Param('key') key: string) {
    return this.lookupService.getByKey(key);
  }

  // ─── Management endpoints (authenticated) ─────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a lookup group' })
  createGroup(
    @Body()
    body: {
      key: string;
      name: string;
      description?: string;
      isPublic?: boolean;
    },
  ) {
    return this.lookupService.createGroup(body);
  }

  @Patch(':groupId')
  @ApiOperation({ summary: 'Update a lookup group' })
  updateGroup(
    @Param('groupId') groupId: string,
    @Body()
    body: { name?: string; description?: string; isPublic?: boolean },
  ) {
    return this.lookupService.updateGroup(groupId, body);
  }

  @Delete(':groupId')
  @ApiOperation({ summary: 'Delete a lookup group and its values' })
  deleteGroup(@Param('groupId') groupId: string) {
    return this.lookupService.deleteGroup(groupId);
  }

  @Post(':groupId/values')
  @ApiOperation({ summary: 'Add a value to a lookup group' })
  addValue(
    @Param('groupId') groupId: string,
    @Body() body: { label: string; value: string; order?: number },
  ) {
    return this.lookupService.addValue(groupId, body);
  }

  @Patch('values/:id')
  @ApiOperation({ summary: 'Update a lookup value' })
  updateValue(
    @Param('id') id: string,
    @Body()
    body: {
      label?: string;
      value?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.lookupService.updateValue(id, body);
  }

  @Delete('values/:id')
  @ApiOperation({ summary: 'Delete a lookup value' })
  deleteValue(@Param('id') id: string) {
    return this.lookupService.deleteValue(id);
  }
}
