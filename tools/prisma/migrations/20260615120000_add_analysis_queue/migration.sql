-- CreateTable
CREATE TABLE "AnalysisQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT 'document',
    "force" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "runId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AnalysisQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisQueueItem_userId_createdAt_idx" ON "AnalysisQueueItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalysisQueueItem_batchId_idx" ON "AnalysisQueueItem"("batchId");

-- CreateIndex
CREATE INDEX "AnalysisQueueItem_status_idx" ON "AnalysisQueueItem"("status");
