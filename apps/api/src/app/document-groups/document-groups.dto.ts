import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreateGroupSchema = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(['bundle', 'folder', 'matter']).default('folder'),
  metadata: z.record(z.string(), z.unknown()).default({}),
  ownerOrgId: z.string().cuid().optional(),
});

export class CreateGroupDto extends createZodDto(CreateGroupSchema) {}

const PatchGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  kind: z.enum(['bundle', 'folder', 'matter']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export class PatchGroupDto extends createZodDto(PatchGroupSchema) {}

const AddDocumentsSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1).max(50),
});

export class AddDocumentsDto extends createZodDto(AddDocumentsSchema) {}

const ListGroupsQuerySchema = z.object({
  kind: z.enum(['bundle', 'folder', 'matter']).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['name', 'updated', 'created']).default('updated'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export class ListGroupsQueryDto extends createZodDto(ListGroupsQuerySchema) {}

const GroupSearchSchema = z.object({
  q: z.string().trim().min(1).max(300),
  sort: z.enum(['relevance', 'recent', 'title']).default('relevance'),
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export class GroupSearchDto extends createZodDto(GroupSearchSchema) {}
