-- AlterTable
ALTER TABLE "Nominee" ADD COLUMN     "aadhaarMasked" TEXT,
ADD COLUMN     "dataEncrypted" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "panMasked" TEXT,
ADD COLUMN     "vaultEntityId" TEXT;

-- CreateIndex
CREATE INDEX "Nominee_vaultEntityId_idx" ON "Nominee"("vaultEntityId");
