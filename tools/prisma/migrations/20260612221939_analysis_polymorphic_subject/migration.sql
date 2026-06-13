-- docs/09 #6: make AnalysisRun + SourceChunk polymorphic over their subject so
-- analyse/ask works on drafting Documents as well as uploaded SourceDocuments.
--
-- NOTE: Prisma's generator also emitted DROP INDEX for the SearchIndex GIN/
-- trgm/HNSW indexes and a `tsv DROP DEFAULT` — those are spurious drift because
-- Prisma can't represent generated columns / pgvector indexes (they live in the
-- add_search_index migration's raw SQL). Those statements were removed by hand;
-- every future migration that touches the schema must be pruned the same way.

-- AlterTable: AnalysisRun → polymorphic subject + dedupe hash.
ALTER TABLE "AnalysisRun" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "subjectType" TEXT NOT NULL DEFAULT 'source',
ALTER COLUMN "sourceDocumentId" DROP NOT NULL;

-- AlterTable: SourceChunk → polymorphic subject.
ALTER TABLE "SourceChunk" ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "subjectType" TEXT NOT NULL DEFAULT 'source',
ALTER COLUMN "sourceDocumentId" DROP NOT NULL;

-- Backfill: existing rows are all source-scoped; subjectId = sourceDocumentId.
UPDATE "AnalysisRun" SET "subjectId" = "sourceDocumentId" WHERE "subjectId" IS NULL;
UPDATE "SourceChunk" SET "subjectId" = "sourceDocumentId" WHERE "subjectId" IS NULL;

-- CreateIndex
CREATE INDEX "AnalysisRun_subjectType_subjectId_createdAt_idx" ON "AnalysisRun"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "SourceChunk_subjectType_subjectId_idx" ON "SourceChunk"("subjectType", "subjectId");
