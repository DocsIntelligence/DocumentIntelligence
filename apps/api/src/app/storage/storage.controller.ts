import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { extname } from 'node:path';
import type {} from 'multer';
import type { User } from '@org/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { StorageService } from './storage.service';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain',
};

@ApiTags('storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('bearer')
@ApiCookieAuth('access_token')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Check if storage is configured' })
  getStatus() {
    return { enabled: this.storage.isEnabled() };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Query('folder') folder?: string,
  ) {
    return this.storage.upload(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      folder: folder ?? undefined,
      userId: user.id,
    });
  }

  @Post('presign/upload')
  @ApiOperation({ summary: 'Get a presigned URL for direct upload' })
  async getPresignedUpload(
    @Body() body: { filename: string; contentType: string; folder?: string },
    @CurrentUser() user: User,
  ) {
    const ext = body.filename.split('.').pop() ?? '';
    const key = body.folder
      ? `${body.folder}/${crypto.randomUUID()}.${ext}`
      : `${user.id}/${crypto.randomUUID()}.${ext}`;

    return this.storage.getPresignedUploadUrl(key, body.contentType);
  }

  @Post('presign/download')
  @ApiOperation({ summary: 'Get a presigned URL for download' })
  async getPresignedDownload(@Body() body: { key: string }) {
    const url = await this.storage.getPresignedDownloadUrl(body.key);
    return { url };
  }

  @Get('files')
  @ApiOperation({ summary: 'List files in user folder' })
  async listFiles(@CurrentUser() user: User, @Query('prefix') prefix?: string) {
    return this.storage.list(prefix ?? `${user.id}/`);
  }

  @Delete('{*key}')
  @ApiOperation({ summary: 'Delete a file by key' })
  async deleteFile(@Param('key') key: string) {
    await this.storage.delete(key);
    return { message: 'File deleted' };
  }

  /**
   * Public download route used only by the local-fs storage backend (no
   * presigned-URL machinery to lean on in dev). The S3 path serves
   * downloads directly via S3 presigned URLs and never hits this route.
   *
   * Keys are not signed — they contain a UUID per upload, so they're not
   * trivially enumerable, and this only fires when STORAGE_ENDPOINT is
   * unset (i.e. local dev). Production should configure S3.
   */
  @Get('local/{*key}')
  @Public()
  @ApiOperation({ summary: 'Stream a file from the local-fs storage backend (dev only)' })
  async downloadLocal(
    @Param('key') key: string | string[],
    @Res() res: Response,
  ) {
    if (!this.storage.isLocalBackend()) {
      throw new NotFoundException();
    }
    const joined = Array.isArray(key) ? key.join('/') : key;
    try {
      const buf = await this.storage.readBuffer(joined);
      const ct = CONTENT_TYPES[extname(joined).toLowerCase()] ?? 'application/octet-stream';
      res.setHeader('Content-Type', ct);
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.send(buf);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw e;
    }
  }
}
