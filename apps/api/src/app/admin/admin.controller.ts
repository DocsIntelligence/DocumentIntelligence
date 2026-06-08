import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

const parsePositiveInt = (
  raw: string | undefined,
  fallback: number,
  max?: number,
) => {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  const truncated = Math.trunc(n);
  return max ? Math.min(truncated, max) : truncated;
};

@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('admin')
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform stats' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated)' })
  getUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getUsers(
      parsePositiveInt(page, 1),
      parsePositiveInt(limit, 20, 100),
    );
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  updateRole(
    @CurrentUser() current: User,
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    if (!Object.values(Role).includes(role as Role)) {
      throw new BadRequestException(
        `Invalid role. Expected one of: ${Object.values(Role).join(', ')}`,
      );
    }
    if (id === current.id && role !== Role.admin) {
      throw new BadRequestException('Admins cannot demote themselves');
    }
    return this.adminService.updateUserRole(id, role as Role);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user' })
  deleteUser(@CurrentUser() current: User, @Param('id') id: string) {
    if (id === current.id) {
      throw new BadRequestException('Admins cannot delete themselves');
    }
    return this.adminService.deleteUser(id);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List all plans (including inactive)' })
  getPlans() {
    return this.adminService.getPlans();
  }

  @Get('lookups')
  @ApiOperation({ summary: 'List all lookup groups (including non-public)' })
  getLookups() {
    return this.adminService.getLookups();
  }
}
