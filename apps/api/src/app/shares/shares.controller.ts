import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateShareDto, PublicCommentDto, UnlockShareDto } from './shares.dto';
import { SharesService } from './shares.service';

@ApiTags('shares')
@Controller('shares')
export class SharesController {
  constructor(private readonly shares: SharesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Create a share link for a document' })
  create(@CurrentUser() user: User, @Body() body: CreateShareDto) {
    return this.shares.create(user.id, body);
  }

  @Post('public/:token')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary:
      'Fetch a shared document via its token. POST so the optional password is not logged in URLs.',
  })
  resolve(@Param('token') token: string, @Body() body: UnlockShareDto) {
    return this.shares.getPublicByToken(token, body);
  }

  @Post('public/:token/comments')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Add a comment to a shared document (comment/edit links)',
  })
  comment(@Param('token') token: string, @Body() body: PublicCommentDto) {
    return this.shares.addPublicComment(token, body);
  }
}
