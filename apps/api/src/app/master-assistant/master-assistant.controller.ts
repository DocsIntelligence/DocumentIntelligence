import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterCommitDto, MasterPlanDto } from './master-assistant.dto';
import { MasterAssistantService } from './master-assistant.service';

/**
 * AI-assisted master setup: turn a natural-language prompt into create/update
 * records for a config master (lookups, document types, legal references),
 * with a preview-then-commit flow. See MasterAdapter / MasterAssistantService.
 */
@ApiTags('master-assistant')
@Controller('master-assistant')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class MasterAssistantController {
  constructor(private readonly assistant: MasterAssistantService) {}

  @Get('masters')
  @ApiOperation({ summary: 'List masters that support AI-assisted upsert' })
  masters() {
    return this.assistant.listMasters();
  }

  @Post('plan')
  @ApiOperation({
    summary: 'Generate a reviewable create/update plan from a prompt (writes nothing)',
  })
  plan(@Body() body: MasterPlanDto) {
    return this.assistant.plan(body.masterKey, body.prompt, body.context);
  }

  @Post('commit')
  @ApiOperation({ summary: 'Commit a staged plan (optionally only selected refs)' })
  commit(@Body() body: MasterCommitDto) {
    return this.assistant.commit(body.planId, body.refs, body.edits);
  }
}
