-- DropIndex
DROP INDEX "SearchIndex_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "SearchIndex_title_trgm_idx";

-- DropIndex
DROP INDEX "SearchIndex_tsv_idx";

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "userId" TEXT,
    "orgId" TEXT,
    "sessionId" TEXT,
    "traceId" TEXT,
    "parentSpanId" TEXT,
    "operation" TEXT NOT NULL,
    "featureCode" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT,
    "documentId" TEXT,
    "sourceDocumentId" TEXT,
    "pipelineRunId" TEXT,
    "extractionId" TEXT,
    "analysisRunId" TEXT,
    "batchId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "unitsUsed" INTEGER NOT NULL DEFAULT 0,
    "unitType" TEXT NOT NULL DEFAULT 'tokens',
    "inputBytes" INTEGER,
    "outputBytes" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "pricingId" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "latencyToFirstTokenMs" INTEGER,
    "queuedMs" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'success',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "retryOfId" TEXT,
    "finishReason" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "requestId" TEXT,
    "idempotencyKey" TEXT,
    "temperature" DOUBLE PRECISION,
    "maxTokens" INTEGER,
    "streamed" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "metadata" JSONB,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelPricing" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "unitType" TEXT NOT NULL DEFAULT 'tokens',
    "inputPer1M" DECIMAL(12,6),
    "outputPer1M" DECIMAL(12,6),
    "cachedInputPer1M" DECIMAL(12,6),
    "cacheWritePer1M" DECIMAL(12,6),
    "reasoningPer1M" DECIMAL(12,6),
    "perCallUsd" DECIMAL(12,6),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL DEFAULT '',
    "value" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "orgId" TEXT,
    "featureCode" TEXT,
    "period" TEXT NOT NULL DEFAULT 'monthly',
    "limitUsd" DECIMAL(12,2) NOT NULL,
    "warnAt" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "hardCap" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_orgId_createdAt_idx" ON "AiUsage"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_sessionId_idx" ON "AiUsage"("sessionId");

-- CreateIndex
CREATE INDEX "AiUsage_traceId_idx" ON "AiUsage"("traceId");

-- CreateIndex
CREATE INDEX "AiUsage_documentId_idx" ON "AiUsage"("documentId");

-- CreateIndex
CREATE INDEX "AiUsage_sourceDocumentId_idx" ON "AiUsage"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "AiUsage_pipelineRunId_idx" ON "AiUsage"("pipelineRunId");

-- CreateIndex
CREATE INDEX "AiUsage_extractionId_idx" ON "AiUsage"("extractionId");

-- CreateIndex
CREATE INDEX "AiUsage_analysisRunId_idx" ON "AiUsage"("analysisRunId");

-- CreateIndex
CREATE INDEX "AiUsage_batchId_idx" ON "AiUsage"("batchId");

-- CreateIndex
CREATE INDEX "AiUsage_operation_createdAt_idx" ON "AiUsage"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_provider_model_createdAt_idx" ON "AiUsage"("provider", "model", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_featureCode_createdAt_idx" ON "AiUsage"("featureCode", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_status_createdAt_idx" ON "AiUsage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiModelPricing_provider_model_active_idx" ON "AiModelPricing"("provider", "model", "active");

-- CreateIndex
CREATE INDEX "AiModelPricing_provider_model_effectiveFrom_idx" ON "AiModelPricing"("provider", "model", "effectiveFrom");

-- CreateIndex
CREATE INDEX "Setting_key_idx" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "Setting_scope_scopeId_idx" ON "Setting"("scope", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_scope_scopeId_key_key" ON "Setting"("scope", "scopeId", "key");

-- CreateIndex
CREATE INDEX "AiBudget_userId_active_idx" ON "AiBudget"("userId", "active");

-- CreateIndex
CREATE INDEX "AiBudget_orgId_active_idx" ON "AiBudget"("orgId", "active");

-- CreateIndex
CREATE INDEX "AiBudget_featureCode_active_idx" ON "AiBudget"("featureCode", "active");
