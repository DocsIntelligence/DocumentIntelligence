import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { CreateCommentDto, ResolveCommentDto } from './comments.dto';
import { CommentsService } from './comments.service';

@ApiTags('comments')
@Controller('documents/:id/comments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'List comments on a document' })
  list(@CurrentUser() user: User, @Param('id') id: string) {
    return this.comments.list(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a comment to a document' })
  create(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
  ) {
    return this.comments.create(user.id, id, body, user.name);
  }

  @Patch(':commentId/resolve')
  @ApiOperation({ summary: 'Resolve / unresolve a comment' })
  resolve(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: ResolveCommentDto,
  ) {
    return this.comments.resolve(user.id, id, commentId, body.resolved);
  }
}
