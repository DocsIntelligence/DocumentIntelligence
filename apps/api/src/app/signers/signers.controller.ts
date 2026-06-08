import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
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
import {
  AddSignerDto,
  RecordSignatureDto,
  UpdateSignerDto,
} from './signers.dto';
import { SignersService } from './signers.service';

@ApiTags('signers')
@Controller('documents/:id/signers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class SignersController {
  constructor(private readonly signers: SignersService) {}

  @Get()
  @ApiOperation({ summary: 'List signers on a document' })
  list(@CurrentUser() user: User, @Param('id') id: string) {
    return this.signers.list(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a signer to a document' })
  add(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: AddSignerDto,
  ) {
    return this.signers.add(user.id, id, body);
  }

  @Patch(':signerId')
  @ApiOperation({ summary: 'Update a signer' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('signerId') signerId: string,
    @Body() body: UpdateSignerDto,
  ) {
    return this.signers.update(user.id, id, signerId, body);
  }

  @Delete(':signerId')
  @ApiOperation({ summary: 'Remove a signer' })
  remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('signerId') signerId: string,
  ) {
    return this.signers.remove(user.id, id, signerId);
  }

  @Post(':signerId/sign')
  @ApiOperation({ summary: 'Record a drawn/typed signature for a signer' })
  sign(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('signerId') signerId: string,
    @Body() body: RecordSignatureDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.signers.sign(user.id, id, signerId, body, { ip, userAgent });
  }
}
