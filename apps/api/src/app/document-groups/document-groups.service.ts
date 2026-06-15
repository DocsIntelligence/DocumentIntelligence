import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import {
  AddDocumentsDto,
  CreateGroupDto,
  ListGroupsQueryDto,
  PatchGroupDto,
} from './document-groups.dto';

@Injectable()
export class DocumentGroupsService {
  private readonly logger = new Logger(DocumentGroupsService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, query: ListGroupsQueryDto) {
    const where: Prisma.DocumentGroupWhereInput = {
      isActive: true,
      OR: [
        { ownerUserId: userId },
        { ownerOrg: { members: { some: { userId } } } },
      ],
    };

    if (query.kind) where.kind = query.kind;
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };

    const orderBy: Prisma.DocumentGroupOrderByWithRelationInput =
      query.sort === 'name'
        ? { name: query.dir }
        : query.sort === 'created'
          ? { createdAt: query.dir }
          : { updatedAt: query.dir };

    const [items, total] = await this.db.$transaction([
      this.db.documentGroup.findMany({
        where,
        orderBy,
        take: query.pageSize,
        skip: query.page * query.pageSize,
        include: { _count: { select: { documents: true } } },
      }),
      this.db.documentGroup.count({ where }),
    ]);

    return {
      items: items.map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind,
        metadata: g.metadata,
        documentCount: g._count.documents,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(userId: string, id: string) {
    const group = await this.db.documentGroup.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'asc' },
          include: {
            documentType: { select: { key: true, name: true } },
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');
    await this.assertAccess(userId, group);
    return group;
  }

  async create(userId: string, dto: CreateGroupDto) {
    return this.db.documentGroup.create({
      data: {
        name: dto.name,
        kind: dto.kind,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
        ownerUserId: dto.ownerOrgId ? undefined : userId,
        ownerOrgId: dto.ownerOrgId,
      },
    });
  }

  async patch(userId: string, id: string, dto: PatchGroupDto) {
    const existing = await this.db.documentGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Group not found');
    await this.assertAccess(userId, existing);

    return this.db.documentGroup.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.kind != null && { kind: dto.kind }),
        ...(dto.metadata != null && {
          metadata: dto.metadata as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.db.documentGroup.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Group not found');
    await this.assertAccess(userId, existing);

    await this.db.documentGroup.update({
      where: { id },
      data: { isActive: false },
    });
    return { ok: true };
  }

  async addDocuments(userId: string, groupId: string, dto: AddDocumentsDto) {
    const group = await this.db.documentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    await this.assertAccess(userId, group);

    // Single-group invariant: a Document can only belong to one DocumentGroup
    // at a time. We refuse to silently overwrite an existing assignment; the
    // caller must opt in via `overwrite=true` to MOVE docs from another group.
    const docs = await this.db.document.findMany({
      where: {
        id: { in: dto.documentIds },
        OR: [
          { ownerUserId: userId },
          { ownerOrg: { members: { some: { userId } } } },
        ],
      },
      select: { id: true, groupId: true },
    });
    const accessibleIds = new Set(docs.map((d) => d.id));

    const eligibleIds: string[] = []; // ungrouped or already-in-this-group
    const movedIds: string[] = []; // in a different group — assigned only with overwrite
    const skippedIds: string[] = []; // in a different group — skipped (no overwrite)
    const inaccessibleIds: string[] = []; // not accessible to this user

    for (const id of dto.documentIds) {
      if (!accessibleIds.has(id)) {
        inaccessibleIds.push(id);
        continue;
      }
      const doc = docs.find((d) => d.id === id);
      if (!doc) {
        inaccessibleIds.push(id);
        continue;
      }
      if (doc.groupId === null || doc.groupId === groupId) {
        eligibleIds.push(id);
      } else if (dto.overwrite) {
        movedIds.push(id);
      } else {
        skippedIds.push(id);
      }
    }

    const updateIds = [...eligibleIds, ...movedIds];
    if (updateIds.length > 0) {
      await this.db.document.updateMany({
        where: { id: { in: updateIds } },
        data: { groupId },
      });
    }

    return {
      ok: true,
      added: eligibleIds.length,
      moved: movedIds.length,
      skipped: skippedIds.length,
      inaccessible: inaccessibleIds.length,
      // Surface the ids the caller can use to render a precise "X moved, Y
      // skipped" toast / dialog.
      skippedIds,
      movedIds,
    };
  }

  async removeDocument(userId: string, groupId: string, documentId: string) {
    const group = await this.db.documentGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException('Group not found');
    await this.assertAccess(userId, group);

    await this.db.document.updateMany({
      where: { id: documentId, groupId },
      data: { groupId: null },
    });

    return { ok: true };
  }

  private async assertAccess(
    userId: string,
    group: { ownerUserId: string | null; ownerOrgId: string | null },
  ) {
    if (group.ownerUserId && group.ownerUserId === userId) return;
    if (group.ownerOrgId) {
      const member = await this.db.orgMember.findFirst({
        where: { orgId: group.ownerOrgId, userId },
        select: { userId: true },
      });
      if (member) return;
    }
    throw new ForbiddenException('Not your group');
  }
}
