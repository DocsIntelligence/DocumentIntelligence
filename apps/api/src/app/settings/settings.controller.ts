import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { findSetting, SettingsService, type SettingScope } from './settings.service';

/**
 * Endpoints for the scoped settings registry. Admin-role gating is intentionally
 * off for now (user will reactivate the @Roles('admin') guard once every module
 * is in place).
 *
 *  - `GET    /admin/settings?scope=system`        list every known key + effective value
 *  - `GET    /admin/settings/:key?scope=&scopeId=` read the resolved value for an actor
 *  - `PATCH  /admin/settings/:key`                upsert an override (body: { scope, scopeId?, value, notes? })
 *  - `DELETE /admin/settings/:key?scope=&scopeId=` remove an override
 */
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(
    @Query('scope') scope: SettingScope = 'system',
    @Query('scopeId') scopeId?: string,
  ) {
    if (scope !== 'system' && !scopeId) {
      throw new BadRequestException(
        `scopeId is required when scope is "${scope}"`,
      );
    }
    return this.settings.listForScope({ scope, scopeId });
  }

  @Get(':key')
  async getOne(
    @Param('key') key: string,
    @Query('userId') userId?: string,
    @Query('orgId') orgId?: string,
  ) {
    const def = findSetting(key);
    if (!def) throw new BadRequestException(`Unknown setting key: ${key}`);
    const effective = await this.settings.get(def, { userId, orgId });
    return { def, effective };
  }

  @Patch(':key')
  async set(
    @Param('key') key: string,
    @Body()
    body: {
      scope: SettingScope;
      scopeId?: string;
      value: unknown;
      notes?: string;
    },
  ) {
    const def = findSetting(key);
    if (!def) throw new BadRequestException(`Unknown setting key: ${key}`);
    await this.settings.set(def, body.value, {
      scope: body.scope,
      scopeId: body.scopeId,
      notes: body.notes,
    });
    return { ok: true };
  }

  @Delete(':key')
  async clear(
    @Param('key') key: string,
    @Query('scope') scope: SettingScope,
    @Query('scopeId') scopeId?: string,
  ) {
    const def = findSetting(key);
    if (!def) throw new BadRequestException(`Unknown setting key: ${key}`);
    await this.settings.clear(def, { scope, scopeId });
    return { ok: true };
  }
}
