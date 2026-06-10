-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('running', 'needs_review', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "BatchSource" AS ENUM ('multi_file', 'zip', 's3_prefix', 'api');

-- AlterTable
ALTER TABLE "PipelineRun" ADD COLUMN     "batchId" TEXT;

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT,
    "source" "BatchSource" NOT NULL DEFAULT 'multi_file',
    "status" "BatchStatus" NOT NULL DEFAULT 'running',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Batch_ownerUserId_createdAt_idx" ON "Batch"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Batch_ownerOrgId_createdAt_idx" ON "Batch"("ownerOrgId", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineRun_batchId_idx" ON "PipelineRun"("batchId");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
