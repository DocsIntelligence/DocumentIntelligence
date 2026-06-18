-- CreateTable
CREATE TABLE "EstateProfile" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "vaultEntityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isSelf" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstateProfileAccess" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstateProfileAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EstateProfile_ownerUserId_idx" ON "EstateProfile"("ownerUserId");

-- CreateIndex
CREATE INDEX "EstateProfile_vaultEntityId_idx" ON "EstateProfile"("vaultEntityId");

-- CreateIndex
CREATE INDEX "EstateProfileAccess_userId_idx" ON "EstateProfileAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EstateProfileAccess_profileId_userId_key" ON "EstateProfileAccess"("profileId", "userId");

-- AddForeignKey
ALTER TABLE "EstateProfileAccess" ADD CONSTRAINT "EstateProfileAccess_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "EstateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Nominee" ADD COLUMN "profileId" TEXT;
ALTER TABLE "WealthSnapshot" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ReleaseGrant" ADD COLUMN "profileId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_profileId_isActive_idx" ON "Asset"("profileId", "isActive");
CREATE INDEX "Nominee_profileId_idx" ON "Nominee"("profileId");
CREATE INDEX "WealthSnapshot_profileId_asOf_idx" ON "WealthSnapshot"("profileId", "asOf");
