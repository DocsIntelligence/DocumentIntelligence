-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'other',
    "label" TEXT NOT NULL,
    "institution" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "currentValueMinor" BIGINT,
    "identifierMasked" TEXT,
    "dataEncrypted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "maturityDate" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "sourceDocumentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetValuation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "valueMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDocument" (
    "id" TEXT NOT NULL,
    "assetId" TEXT,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "slotKey" TEXT NOT NULL DEFAULT 'default',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "s3Key" TEXT NOT NULL,
    "checksum" TEXT,
    "periodAsOf" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WealthSnapshot" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "netWorthMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "totalsByType" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstateVaultConfig" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstateVaultConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_ownerUserId_updatedAt_idx" ON "Asset"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "Asset_ownerOrgId_updatedAt_idx" ON "Asset"("ownerOrgId", "updatedAt");

-- CreateIndex
CREATE INDEX "Asset_ownerUserId_isActive_idx" ON "Asset"("ownerUserId", "isActive");

-- CreateIndex
CREATE INDEX "AssetValuation_assetId_asOf_idx" ON "AssetValuation"("assetId", "asOf");

-- CreateIndex
CREATE INDEX "AssetDocument_assetId_periodAsOf_idx" ON "AssetDocument"("assetId", "periodAsOf");

-- CreateIndex
CREATE INDEX "AssetDocument_slotKey_idx" ON "AssetDocument"("slotKey");

-- CreateIndex
CREATE INDEX "WealthSnapshot_ownerUserId_asOf_idx" ON "WealthSnapshot"("ownerUserId", "asOf");

-- CreateIndex
CREATE INDEX "WealthSnapshot_ownerOrgId_asOf_idx" ON "WealthSnapshot"("ownerOrgId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "EstateVaultConfig_ownerOrgId_key" ON "EstateVaultConfig"("ownerOrgId");

-- AddForeignKey
ALTER TABLE "AssetValuation" ADD CONSTRAINT "AssetValuation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDocument" ADD CONSTRAINT "AssetDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
