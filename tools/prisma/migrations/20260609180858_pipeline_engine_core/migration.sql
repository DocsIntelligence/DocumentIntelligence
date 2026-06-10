-- CreateEnum
CREATE TYPE "PipelineStageType" AS ENUM ('ingest', 'classify', 'extract', 'validate', 'review', 'export');

-- CreateEnum
CREATE TYPE "PipelineRunStatus" AS ENUM ('queued', 'running', 'needs_review', 'approved', 'completed', 'failed', 'rejected');

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "PipelineStageType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "currentStageId" TEXT,
    "status" "PipelineRunStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageExecution" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "stageType" "PipelineStageType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "score" DOUBLE PRECISION,
    "output" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pipeline_ownerOrgId_idx" ON "Pipeline"("ownerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_ownerOrgId_key_version_key" ON "Pipeline"("ownerOrgId", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_pipelineId_order_key" ON "PipelineStage"("pipelineId", "order");

-- CreateIndex
CREATE INDEX "PipelineRun_pipelineId_status_idx" ON "PipelineRun"("pipelineId", "status");

-- CreateIndex
CREATE INDEX "PipelineRun_sourceDocumentId_idx" ON "PipelineRun"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "StageExecution_pipelineRunId_idx" ON "StageExecution"("pipelineRunId");

-- CreateIndex
CREATE INDEX "StageExecution_status_heartbeatAt_idx" ON "StageExecution"("status", "heartbeatAt");

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageExecution" ADD CONSTRAINT "StageExecution_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
