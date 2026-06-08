import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import type {
  AddSignerDto,
  RecordSignatureDto,
  UpdateSignerDto,
} from './signers.dto';

/** Signature evidence stored on DocumentSigner.evidence (Json). */
interface DrawnTypedEvidence {
  method: 'draw' | 'upload' | 'typed';
  image?: string;
  typedText?: string;
  font?: string;
  ip?: string;
  userAgent?: string;
  signedAt: string;
}

@Injectable()
export class SignersService {
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
    return this.db.documentSigner.findMany({
      where: { documentId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async add(userId: string, documentId: string, dto: AddSignerDto) {
    await this.assertAccess(userId, documentId);
    // Append at the end of the signing order when none supplied.
    const order =
      dto.order ??
      (await this.db.documentSigner.count({ where: { documentId } }));
    return this.db.documentSigner.create({
      data: {
        documentId,
        name: dto.name,
        email: dto.email ?? null,
        role: dto.role,
        order,
      },
    });
  }

  async update(
    userId: string,
    documentId: string,
    signerId: string,
    dto: UpdateSignerDto,
  ) {
    await this.assertAccess(userId, documentId);
    await this.getOwned(documentId, signerId);
    return this.db.documentSigner.update({
      where: { id: signerId },
      data: {
        name: dto.name,
        email: dto.email === undefined ? undefined : dto.email,
        role: dto.role,
        order: dto.order,
      },
    });
  }

  async remove(userId: string, documentId: string, signerId: string) {
    await this.assertAccess(userId, documentId);
    await this.getOwned(documentId, signerId);
    await this.db.documentSigner.delete({ where: { id: signerId } });
    return { id: signerId };
  }

  async sign(
    userId: string,
    documentId: string,
    signerId: string,
    dto: RecordSignatureDto,
    meta: { ip?: string; userAgent?: string },
  ) {
    await this.assertAccess(userId, documentId);
    await this.getOwned(documentId, signerId);

    const evidence: DrawnTypedEvidence = {
      method: dto.method,
      image: dto.image,
      typedText: dto.typedText,
      font: dto.font,
      ip: meta.ip,
      userAgent: meta.userAgent,
      // Stamped server-side so the signing time is trustworthy.
      signedAt: new Date().toISOString(),
    };

    const signer = await this.db.documentSigner.update({
      where: { id: signerId },
      data: {
        status: 'signed',
        provider: dto.method, // 'draw' | 'typed'
        evidence: evidence as unknown as Prisma.InputJsonValue,
        signedAt: new Date(),
      },
    });

    // When every signer has signed, mark the document signed.
    const remaining = await this.db.documentSigner.count({
      where: { documentId, status: { not: 'signed' } },
    });
    if (remaining === 0) {
      await this.db.document.update({
        where: { id: documentId },
        data: { status: 'signed' },
      });
    }
    return signer;
  }

  private async getOwned(documentId: string, signerId: string) {
    const signer = await this.db.documentSigner.findUnique({
      where: { id: signerId },
    });
    if (!signer || signer.documentId !== documentId) {
      throw new NotFoundException('Signer not found');
    }
    return signer;
  }
}
