-- CreateTable
CREATE TABLE "Nominee" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneEnc" TEXT,
    "relationship" TEXT,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nominee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetNomination" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "sharePercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetNomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseGrant" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'nominated',
    "status" TEXT NOT NULL DEFAULT 'active',
    "cadenceDays" INTEGER NOT NULL DEFAULT 90,
    "lastCheckInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextPingAt" TIMESTAMP(3) NOT NULL,
    "missedCount" INTEGER NOT NULL DEFAULT 0,
    "accessToken" TEXT NOT NULL,
    "proofRefs" JSONB,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstateAccessLog" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "nomineeId" TEXT,
    "grantId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstateAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Nominee_ownerUserId_idx" ON "Nominee"("ownerUserId");

-- CreateIndex
CREATE INDEX "AssetNomination_nomineeId_idx" ON "AssetNomination"("nomineeId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetNomination_assetId_nomineeId_key" ON "AssetNomination"("assetId", "nomineeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseGrant_accessToken_key" ON "ReleaseGrant"("accessToken");

-- CreateIndex
CREATE INDEX "ReleaseGrant_status_nextPingAt_idx" ON "ReleaseGrant"("status", "nextPingAt");

-- CreateIndex
CREATE INDEX "ReleaseGrant_ownerUserId_idx" ON "ReleaseGrant"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseGrant_ownerUserId_nomineeId_key" ON "ReleaseGrant"("ownerUserId", "nomineeId");

-- CreateIndex
CREATE INDEX "EstateAccessLog_ownerUserId_createdAt_idx" ON "EstateAccessLog"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EstateAccessLog_grantId_createdAt_idx" ON "EstateAccessLog"("grantId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssetNomination" ADD CONSTRAINT "AssetNomination_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetNomination" ADD CONSTRAINT "AssetNomination_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "Nominee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseGrant" ADD CONSTRAINT "ReleaseGrant_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "Nominee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
