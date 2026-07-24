import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { EnterpriseLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Public()
  @Post('enterprise')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Public marketing form — tighter than the app-wide 120/min default so it
  // can't be used to spam the support inbox.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit an enterprise / self-hosted inquiry' })
  async submitEnterprise(@Body() dto: EnterpriseLeadDto): Promise<void> {
    await this.leads.submitEnterpriseInquiry(dto);
  }
}
