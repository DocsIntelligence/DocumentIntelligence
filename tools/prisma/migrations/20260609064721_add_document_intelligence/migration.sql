-- CreateEnum
CREATE TYPE "SourceDocStatus" AS ENUM ('uploaded', 'processing', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "IntelligenceJobStatus" AS ENUM ('queued', 'processing', 'needs_review', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "IntelligenceStage" AS ENUM ('uploaded', 'normalize', 'classify', 'extract', 'analyse', 'review', 'convert');

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "checksum" TEXT,
    "s3Key" TEXT NOT NULL,
    "pageCount" INTEGER,
    "language" TEXT,
    "status" "SourceDocStatus" NOT NULL DEFAULT 'uploaded',
    "normalizedText" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceJob" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "status" "IntelligenceJobStatus" NOT NULL DEFAULT 'queued',
    "stage" "IntelligenceStage" NOT NULL DEFAULT 'uploaded',
    "documentTypeKey" TEXT,
    "telemetry" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Extraction" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "jobId" TEXT,
    "schemaKey" TEXT NOT NULL,
    "documentTypeKey" TEXT,
    "fields" JSONB NOT NULL,
    "confidence" JSONB NOT NULL,
    "overallConfidence" DOUBLE PRECISION,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "edits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Extraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceDocument_ownerUserId_updatedAt_idx" ON "SourceDocument"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "SourceDocument_ownerOrgId_updatedAt_idx" ON "SourceDocument"("ownerOrgId", "updatedAt");

-- CreateIndex
CREATE INDEX "SourceDocument_status_idx" ON "SourceDocument"("status");

-- CreateIndex
CREATE INDEX "IntelligenceJob_status_heartbeatAt_idx" ON "IntelligenceJob"("status", "heartbeatAt");

-- CreateIndex
CREATE INDEX "IntelligenceJob_sourceDocumentId_idx" ON "IntelligenceJob"("sourceDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Extraction_jobId_key" ON "Extraction"("jobId");

-- CreateIndex
CREATE INDEX "Extraction_sourceDocumentId_idx" ON "Extraction"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "Extraction_schemaKey_idx" ON "Extraction"("schemaKey");

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_ownerOrgId_fkey" FOREIGN KEY ("ownerOrgId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceJob" ADD CONSTRAINT "IntelligenceJob_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extraction" ADD CONSTRAINT "Extraction_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Extraction" ADD CONSTRAINT "Extraction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntelligenceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
