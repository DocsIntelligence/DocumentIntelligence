


-- CreateTable
CREATE TABLE "VaultEntity" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'person',
    "label" TEXT NOT NULL,
    "dataEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDocument" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "s3Key" TEXT NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultAccessLog" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultEntity_ownerUserId_updatedAt_idx" ON "VaultEntity"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "VaultEntity_ownerOrgId_updatedAt_idx" ON "VaultEntity"("ownerOrgId", "updatedAt");

-- CreateIndex
CREATE INDEX "VaultDocument_entityId_idx" ON "VaultDocument"("entityId");

-- CreateIndex
CREATE INDEX "VaultAccessLog_entityId_createdAt_idx" ON "VaultAccessLog"("entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "VaultDocument" ADD CONSTRAINT "VaultDocument_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "VaultEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultAccessLog" ADD CONSTRAINT "VaultAccessLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "VaultEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
