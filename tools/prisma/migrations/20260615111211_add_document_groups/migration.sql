-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "DocumentGroup" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'folder',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentGroup_ownerUserId_updatedAt_idx" ON "DocumentGroup"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "DocumentGroup_ownerOrgId_updatedAt_idx" ON "DocumentGroup"("ownerOrgId", "updatedAt");

-- CreateIndex
CREATE INDEX "DocumentGroup_kind_idx" ON "DocumentGroup"("kind");

-- CreateIndex
CREATE INDEX "Document_groupId_idx" ON "Document"("groupId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DocumentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentGroup" ADD CONSTRAINT "DocumentGroup_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentGroup" ADD CONSTRAINT "DocumentGroup_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
