import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EstateReportService } from '../services/estate-report.service';
import { ReleaseService } from '../services/release.service';

type UploadedFileT = { buffer: Buffer; originalname: string; mimetype: string };

/**
 * Public, token-guarded nominee access (docs/13 §1.2). No auth: the opaque
 * access token IS the credential. The asset register only resolves once the
 * grant is `released`; before that, the nominee can check status and submit
 * proof of death (which queues a human review — never auto-releases). Audited.
 */
@ApiTags('estate-vault')
@Controller('estate/nominee-access')
export class EstateNomineeController {
  constructor(
    private readonly report: EstateReportService,
    private readonly release: ReleaseService,
  ) {}

  @Get(':token')
  @ApiOperation({
    summary:
      'Released nominee view — scoped asset register + how-to-claim (403 until released).',
  })
  view(@Param('token') token: string) {
    return this.report.nomineeView(token);
  }

  @Get(':token/status')
  @ApiOperation({
    summary: 'Grant status for the nominee page (no asset data) — drives the proof form.',
  })
  status(@Param('token') token: string) {
    return this.release.proofStatus(token);
  }

  @Post(':token/proof')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Nominee submits proof of death (queues human review; no auto-release).',
  })
  submitProof(
    @Param('token') token: string,
    @UploadedFile() file: UploadedFileT,
    @Body('note') note?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.release.submitProof(token, file, note);
  }
}
