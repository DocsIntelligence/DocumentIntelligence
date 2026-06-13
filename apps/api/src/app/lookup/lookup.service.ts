import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class LookupService {
  constructor(private readonly db: DatabaseService) {}

  /** Get all public lookup groups with their values */
  async getAllPublic() {
    return this.db.lookupGroup.findMany({
      where: { isPublic: true },
      include: {
        values: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /** Get a single lookup group by key */
  async getByKey(key: string) {
    const group = await this.db.lookupGroup.findUnique({
      where: { key },
      include: {
        values: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException(`Lookup group "${key}" not found`);
    return group;
  }

  /** Admin: get all groups (including non-public) */
  async getAll() {
    return this.db.lookupGroup.findMany({
      include: { values: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  /** Admin: server-side paginated groups (with their values) + search. */
  async getAllPaginated(query: { q?: string; page: number; pageSize: number }) {
    const where: Prisma.LookupGroupWhereInput = query.q
      ? {
          OR: [
            { key: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await this.db.$transaction([
      this.db.lookupGroup.findMany({
        where,
        include: { _count: { select: { values: true } } },
        orderBy: { name: 'asc' },
        take: query.pageSize,
        skip: query.page * query.pageSize,
      }),
      this.db.lookupGroup.count({ where }),
    ]);
    // Lean summaries — values are fetched per-group on select (getOneAdmin).
    const items = rows.map((g) => ({
      id: g.id,
      key: g.key,
      name: g.name,
      description: g.description,
      isPublic: g.isPublic,
      valueCount: g._count.values,
    }));
    return { items, total };
  }

  /** Admin: one group WITH its values (fetched when the group is selected). */
  async getOneAdmin(id: string) {
    const group = await this.db.lookupGroup.findUnique({
      where: { id },
      include: { values: { orderBy: { order: 'asc' } } },
    });
    if (!group) throw new NotFoundException('Lookup group not found');
    return group;
  }

  /** Admin: create a new lookup group */
  async createGroup(data: {
    key: string;
    name: string;
    description?: string;
    isPublic?: boolean;
  }) {
    return this.db.lookupGroup.create({ data });
  }

  /** Admin: update a group's properties */
  async updateGroup(
    id: string,
    data: { name?: string; description?: string; isPublic?: boolean },
  ) {
    const exists = await this.db.lookupGroup.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Lookup group not found');
    return this.db.lookupGroup.update({ where: { id }, data });
  }

  /** Admin: delete a group and all its values */
  async deleteGroup(id: string) {
    const exists = await this.db.lookupGroup.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Lookup group not found');
    await this.db.$transaction([
      this.db.lookupValue.deleteMany({ where: { groupId: id } }),
      this.db.lookupGroup.delete({ where: { id } }),
    ]);
    return { message: 'Group deleted' };
  }

  /** Admin: add a value to a group */
  async addValue(
    groupId: string,
    data: { label: string; value: string; order?: number },
  ) {
    return this.db.lookupValue.create({
      data: { ...data, groupId },
    });
  }

  /** Admin: update a value */
  async updateValue(
    id: string,
    data: {
      label?: string;
      value?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.db.lookupValue.update({ where: { id }, data });
  }

  /** Admin: delete a value */
  async deleteValue(id: string) {
    await this.db.lookupValue.delete({ where: { id } });
    return { message: 'Value deleted' };
  }
}
