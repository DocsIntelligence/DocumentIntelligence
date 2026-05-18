import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClauseRewriteDto, RuleSuggestDto } from './legal-ai.dto';
import { LegalAiService } from './legal-ai.service';

@ApiTags('legal-ai')
@Controller('legal-ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class LegalAiController {
  constructor(private readonly legalAi: LegalAiService) {}

  @Post('clause-rewrite')
  @ApiOperation({ summary: 'Rewrite a clause in a chosen tone' })
  clauseRewrite(@CurrentUser() user: User, @Body() body: ClauseRewriteDto) {
    return this.legalAi.clauseRewrite(user.id, body);
  }

  @Post('rule-suggest')
  @ApiOperation({ summary: 'Suggest fair house-rule clauses' })
  ruleSuggest(@CurrentUser() user: User, @Body() body: RuleSuggestDto) {
    return this.legalAi.ruleSuggest(user.id, body);
  }
}
