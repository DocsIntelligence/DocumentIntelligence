import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import type {
  CreateShareDto,
  PublicCommentDto,
  UnlockShareDto,
} from './shares.dto';

@Injectable()
export class SharesService {
  constructor(private readonly db: DatabaseService) {}

  // Token = 48 hex chars from 24 random bytes. URL-safe and short enough.
  private mintToken(): string {
    return randomBytes(24).toString('hex');
  }

  async create(userId: string, dto: CreateShareDto) {
    const doc = await this.db.document.findUnique({
      where: { id: dto.documentId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerUserId !== userId) {
      // Org docs: check membership.
      if (!doc.ownerOrgId) throw new ForbiddenException('Not allowed');
      const m = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: doc.ownerOrgId, userId } },
      });
      if (!m) throw new ForbiddenException('Not allowed');
    }

    const token = this.mintToken();
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const share = await this.db.documentShare.create({
      data: {
        documentId: doc.id,
        token,
        mode: dto.mode,
        passwordHash,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: userId,
      },
    });

    return { ...share, passwordHash: undefined };
  }

  async getPublicByToken(token: string, dto: UnlockShareDto) {
    const share = await this.db.documentShare.findUnique({
      where: { token },
      include: {
        document: { include: { template: true, documentType: true } },
      },
    });
    if (!share) throw new NotFoundException('Share link not found');
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException('Share link expired');
    }
    if (share.passwordHash) {
      if (!dto.password) {
        return { requiresPassword: true } as const;
      }
      const ok = await bcrypt.compare(dto.password, share.passwordHash);
      if (!ok) throw new ForbiddenException('Wrong password');
    }

    await this.db.documentShare.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });

    const { document } = share;
    // Comments are visible on comment/edit shares only.
    const comments =
      share.mode === 'view'
        ? []
        : await this.db.documentComment.findMany({
            where: { documentId: document.id },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              authorName: true,
              body: true,
              resolved: true,
              createdAt: true,
            },
          });
    return {
      mode: share.mode,
      comments,
      document: {
        id: document.id,
        title: document.title,
        status: document.status,
        pageSize: document.pageSize,
        language: document.language,
        jurisdiction: document.jurisdiction,
        data: document.data,
        documentType: {
          key: document.documentType.key,
          name: document.documentType.name,
        },
        template: {
          key: document.template.key,
          name: document.template.name,
          componentKey: document.template.componentKey,
        },
      },
    };
  }

  async addPublicComment(token: string, dto: PublicCommentDto) {
    const share = await this.db.documentShare.findUnique({ where: { token } });
    if (!share) throw new NotFoundException('Share link not found');
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new ForbiddenException('Share link expired');
    }
    if (share.mode === 'view') {
      throw new ForbiddenException('This link does not allow comments');
    }
    if (share.passwordHash) {
      if (!dto.password) throw new ForbiddenException('Password required');
      const ok = await bcrypt.compare(dto.password, share.passwordHash);
      if (!ok) throw new ForbiddenException('Wrong password');
    }
    const comment = await this.db.documentComment.create({
      data: {
        documentId: share.documentId,
        authorId: null,
        authorName: dto.authorName,
        anchor: {},
        body: dto.body,
      },
    });
    return {
      id: comment.id,
      authorName: comment.authorName,
      body: comment.body,
      resolved: comment.resolved,
      createdAt: comment.createdAt,
    };
  }
}
