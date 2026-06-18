-- CreateTable
CREATE TABLE "DataKey" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "principalType" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "wrappedDek" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataKey_principalType_principalId_idx" ON "DataKey"("principalType", "principalId");

-- CreateIndex
CREATE UNIQUE INDEX "DataKey_assetId_principalType_principalId_key" ON "DataKey"("assetId", "principalType", "principalId");

-- AddForeignKey
ALTER TABLE "DataKey" ADD CONSTRAINT "DataKey_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
