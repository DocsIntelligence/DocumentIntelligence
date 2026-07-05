import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, extname, join, resolve } from 'node:path';

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/**
 * Storage abstraction with two backends:
 *
 *   S3      — when STORAGE_ENDPOINT/ACCESS_KEY/SECRET_KEY are set.
 *             Production path. Uses presigned URLs.
 *   Local   — fallback for dev. Writes to a directory on disk
 *             (`STORAGE_LOCAL_ROOT`, default `.storage-local/` under
 *             the API cwd). Downloads are served by the public
 *             `/storage/local/{*key}` controller route.
 *
 * `isEnabled()` reports true in both modes — there's no longer a
 * "storage disabled" state. Production-only code paths (presigned
 * direct uploads from browser) still require S3 and will return a
 * clear error if called in local mode.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly s3Enabled: boolean;
  private readonly localRoot: string;
  private readonly apiBaseUrl: string;
  private readonly apiPrefix: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT');
    const accessKey = this.config.get<string>('STORAGE_ACCESS_KEY');
    const secretKey = this.config.get<string>('STORAGE_SECRET_KEY');
    this.bucket = this.config.get<string>('STORAGE_BUCKET') ?? 'uploads';
    this.publicUrl =
      this.config.get<string>('STORAGE_PUBLIC_URL') ?? endpoint ?? '';

    this.s3Enabled = Boolean(endpoint && accessKey && secretKey);

    this.localRoot = resolve(
      this.config.get<string>('STORAGE_LOCAL_ROOT') ??
        join(process.cwd(), '.storage-local'),
    );
    this.apiBaseUrl =
      this.config.get<string>('PUBLIC_URL') ?? 'http://localhost:5230';
    this.apiPrefix = this.config.get<string>('GLOBAL_PREFIX') ?? 'api';

    if (this.s3Enabled) {
      this.client = new S3Client({
        endpoint,
        region: this.config.get<string>('STORAGE_REGION') ?? 'us-east-1',
        credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
        forcePathStyle: true,
      });
      this.logger.log(`Storage initialized (S3 endpoint: ${endpoint})`);
    } else {
      this.logger.log(
        `Storage initialized (local fs at ${this.localRoot}). ` +
          `Set STORAGE_ENDPOINT to switch to S3.`,
      );
    }
  }

  isEnabled(): boolean {
    return true;
  }

  /** Resolve a key to an absolute path under the local root, guarding against traversal. */
  private localPath(key: string): string {
    const target = resolve(this.localRoot, key);
    if (!target.startsWith(this.localRoot + '/') && target !== this.localRoot) {
      throw new BadRequestException('Invalid storage key');
    }
    return target;
  }

  async upload(
    file: Buffer,
    options: {
      filename: string;
      contentType: string;
      folder?: string;
      userId?: string;
    },
  ): Promise<UploadResult> {
    const ext = extname(options.filename);
    const key = options.folder
      ? `${options.folder}/${randomUUID()}${ext}`
      : `${options.userId ?? 'public'}/${randomUUID()}${ext}`;

    if (this.client) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: options.contentType,
        }),
      );
      return {
        key,
        url: `${this.publicUrl}/${this.bucket}/${key}`,
        size: file.length,
        contentType: options.contentType,
      };
    }

    // Local-fs branch.
    const target = this.localPath(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file);
    return {
      key,
      url: this.localDownloadUrl(key),
      size: file.length,
      contentType: options.contentType,
    };
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<{ url: string; key: string }> {
    if (!this.client) {
      throw new BadRequestException(
        'Presigned uploads require S3. Configure STORAGE_ENDPOINT.',
      );
    }
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn },
    );
    return { url, key };
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn = 3600,
  ): Promise<string> {
    if (this.client) {
      return getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
    }
    // Local-fs branch: return the public streaming URL. No signing — dev
    // only. Keys contain UUIDs so they're not trivially guessable.
    return this.localDownloadUrl(key);
  }

  async delete(key: string): Promise<void> {
    if (this.client) {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.debug(`Deleted: ${key}`);
      return;
    }
    try {
      await unlink(this.localPath(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }

  async deleteFolder(prefix: string): Promise<number> {
    if (this.client) {
      const listed = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }),
      );
      const keys = listed.Contents?.map((obj) => obj.Key).filter(Boolean) ?? [];
      for (const key of keys) {
        await this.client.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: key! }),
        );
      }
      this.logger.debug(`Deleted ${keys.length} objects in ${prefix}/`);
      return keys.length;
    }
    // Local-fs branch.
    const root = this.localPath(prefix);
    let count = 0;
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isFile()) {
          await unlink(join(root, ent.name));
          count++;
        }
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    return count;
  }

  async exists(key: string): Promise<boolean> {
    if (this.client) {
      try {
        await this.client.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        return true;
      } catch {
        return false;
      }
    }
    try {
      await stat(this.localPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string, maxKeys = 100) {
    if (this.client) {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
        }),
      );
      return (result.Contents ?? []).map((obj) => ({
        key: obj.Key!,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified?.toISOString(),
      }));
    }
    // Local-fs branch: walk the prefix directory.
    const root = this.localPath(prefix);
    const out: { key: string; size: number; lastModified?: string }[] = [];
    try {
      const entries = await readdir(root, { withFileTypes: true });
      for (const ent of entries) {
        if (out.length >= maxKeys) break;
        if (!ent.isFile()) continue;
        const full = join(root, ent.name);
        const s = await stat(full);
        out.push({
          key: `${prefix.replace(/\/$/, '')}/${ent.name}`,
          size: s.size,
          lastModified: s.mtime.toISOString(),
        });
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    return out;
  }

  /**
   * Read a stored object's bytes. Used by the local-fs download
   * controller route. Refuses to leak files outside the local root.
   */
  async readBuffer(key: string): Promise<Buffer> {
    if (this.client) {
      throw new BadRequestException(
        'readBuffer is only available in local-fs storage mode',
      );
    }
    return readFile(this.localPath(key));
  }

  /** True when running on the local-fs backend (used by the controller). */
  isLocalBackend(): boolean {
    return !this.client;
  }

  private localDownloadUrl(key: string): string {
    const base = this.apiBaseUrl.replace(/\/$/, '');
    const prefix = this.apiPrefix.replace(/^\//, '').replace(/\/$/, '');
    const segments = key.split('/').map(encodeURIComponent).join('/');
    return `${base}/${prefix}/storage/local/${segments}`;
  }
}
