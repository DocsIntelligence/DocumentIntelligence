import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import type { CreateCommentDto } from './comments.dto';

@Injectable()
export class CommentsService {
  constructor(private readonly db: DatabaseService) {}

  private async assertAccess(userId: string, documentId: string) {
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerUserId === userId) return doc;
    if (doc.ownerOrgId) {
      const m = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: doc.ownerOrgId, userId } },
      });
      if (m) return doc;
    }
    throw new ForbiddenException('Not allowed');
  }

  async list(userId: string, documentId: string) {
    await this.assertAccess(userId, documentId);
    return this.db.documentComment.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    userId: string,
    documentId: string,
    dto: CreateCommentDto,
    authorName: string,
  ) {
    await this.assertAccess(userId, documentId);
    return this.db.documentComment.create({
      data: {
        documentId,
        authorId: userId,
        authorName,
        anchor: (dto.anchor ?? {}) as Prisma.InputJsonValue,
        body: dto.body,
      },
    });
  }

  async resolve(
    userId: string,
    documentId: string,
    commentId: string,
    resolved: boolean,
  ) {
    await this.assertAccess(userId, documentId);
    const c = await this.db.documentComment.findUnique({
      where: { id: commentId },
    });
    if (!c || c.documentId !== documentId) {
      throw new NotFoundException('Comment not found');
    }
    return this.db.documentComment.update({
      where: { id: commentId },
      data: { resolved },
    });
  }
}
