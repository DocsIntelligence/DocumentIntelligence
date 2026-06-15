-- CreateTable
CREATE TABLE "CitationCritique" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "groundedOn" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitationCritique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CitationCritique_documentId_createdAt_idx" ON "CitationCritique"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CitationCritique_documentId_contentHash_key" ON "CitationCritique"("documentId", "contentHash");
