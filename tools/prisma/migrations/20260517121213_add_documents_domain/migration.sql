-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'in_review', 'ready', 'signed', 'archived');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('user', 'organisation');

-- CreateEnum
CREATE TYPE "SignerRole" AS ENUM ('party_a', 'party_b', 'witness', 'lawyer', 'custom');

-- CreateEnum
CREATE TYPE "SignerStatus" AS ENUM ('pending', 'invited', 'viewed', 'signed', 'declined');

-- CreateEnum
CREATE TYPE "PageSize" AS ENUM ('a4', 'legal', 'foolscap', 'stamp_paper_in_10', 'stamp_paper_in_20', 'stamp_paper_in_50', 'stamp_paper_in_100', 'stamp_paper_in_500');

-- CreateEnum
CREATE TYPE "ShareMode" AS ENUM ('view', 'comment', 'edit');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('agency', 'law_firm', 'individual_lawyer');

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL,
    "defaultPageSize" "PageSize" NOT NULL DEFAULT 'a4',
    "jurisdictions" TEXT[],
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "documentTypeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "jurisdictions" TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "styleTokens" JSONB,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerType" "DocumentOwnerType",
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "documentTypeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL DEFAULT 'user',
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "data" JSONB NOT NULL,
    "pageSize" "PageSize" NOT NULL DEFAULT 'a4',
    "language" TEXT NOT NULL DEFAULT 'en',
    "jurisdiction" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "templateId" TEXT NOT NULL,
    "pageSize" "PageSize" NOT NULL,
    "label" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentShare" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "mode" "ShareMode" NOT NULL DEFAULT 'view',
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSigner" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "role" "SignerRole" NOT NULL,
    "status" "SignerStatus" NOT NULL DEFAULT 'pending',
    "order" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "evidence" JSONB,
    "signedAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExport" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "pageSize" "PageSize" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "s3Key" TEXT,
    "byteSize" INTEGER,
    "checksum" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentComment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "anchor" JSONB NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'agency',
    "brandingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'member',

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandingProfile" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "logoS3Key" TEXT,
    "letterheadS3Key" TEXT,
    "primaryColor" TEXT,
    "footerText" TEXT,
    "barCouncilNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_key_key" ON "DocumentType"("key");

-- CreateIndex
CREATE INDEX "DocumentType_category_idx" ON "DocumentType"("category");

-- CreateIndex
CREATE INDEX "DocumentTemplate_ownerType_ownerUserId_idx" ON "DocumentTemplate"("ownerType", "ownerUserId");

-- CreateIndex
CREATE INDEX "DocumentTemplate_ownerType_ownerOrgId_idx" ON "DocumentTemplate"("ownerType", "ownerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_documentTypeId_key_key" ON "DocumentTemplate"("documentTypeId", "key");

-- CreateIndex
CREATE INDEX "Document_ownerUserId_updatedAt_idx" ON "Document"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_ownerOrgId_updatedAt_idx" ON "Document"("ownerOrgId", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_documentTypeId_idx" ON "Document"("documentTypeId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentShare_token_key" ON "DocumentShare"("token");

-- CreateIndex
CREATE INDEX "DocumentShare_documentId_idx" ON "DocumentShare"("documentId");

-- CreateIndex
CREATE INDEX "DocumentSigner_documentId_order_idx" ON "DocumentSigner"("documentId", "order");

-- CreateIndex
CREATE INDEX "DocumentSigner_status_idx" ON "DocumentSigner"("status");

-- CreateIndex
CREATE INDEX "DocumentExport_documentId_createdAt_idx" ON "DocumentExport"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentComment_documentId_idx" ON "DocumentComment"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_slug_key" ON "Organisation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_brandingId_key" ON "Organisation"("brandingId");

-- CreateIndex
CREATE INDEX "Organisation_slug_idx" ON "Organisation"("slug");

-- CreateIndex
CREATE INDEX "OrgMember_userId_idx" ON "OrgMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandingProfile_ownerUserId_key" ON "BrandingProfile"("ownerUserId");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigner" ADD CONSTRAINT "DocumentSigner_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExport" ADD CONSTRAINT "DocumentExport_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_brandingId_fkey" FOREIGN KEY ("brandingId") REFERENCES "BrandingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandingProfile" ADD CONSTRAINT "BrandingProfile_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
