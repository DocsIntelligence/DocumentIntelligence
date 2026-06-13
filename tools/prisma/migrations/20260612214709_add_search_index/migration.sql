-- Search (docs/09): unified full-text + semantic index across both doc worlds.
-- Requires the pg_trgm (fuzzy) and vector (pgvector, semantic) extensions.
-- Verified available on the target Postgres (PG16, pg_trgm 1.6 installed,
-- vector 0.5.0 available with HNSW). pgvector binary must also exist in prod.
-- pg_trgm/vector opclasses can live in `public`; ensure it's on the search_path
-- for this migration (Prisma otherwise scopes to the app schema only).
SET search_path TO "starter", public;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "SearchIndex" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerOrgId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL DEFAULT '',
    -- Generated tsvector: title weighted 'A', body weighted 'B'. 'english'
    -- regconfig literal keeps the expression IMMUTABLE (required for STORED).
    "tsv" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("bodyText", '')), 'B')
    ) STORED,
    "embedding" vector(1536),
    "contentHash" TEXT NOT NULL DEFAULT '',
    "type" TEXT,
    "status" TEXT,
    "refUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchConfig" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "keywordWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "semanticWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "semanticEnabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledKinds" TEXT[] DEFAULT ARRAY['document', 'source']::TEXT[],
    "fuzzyThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "snippetWords" INTEGER NOT NULL DEFAULT 30,
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "maxResults" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchIndex_ownerUserId_idx" ON "SearchIndex"("ownerUserId");

-- CreateIndex
CREATE INDEX "SearchIndex_ownerOrgId_idx" ON "SearchIndex"("ownerOrgId");

-- CreateIndex
CREATE INDEX "SearchIndex_kind_idx" ON "SearchIndex"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndex_kind_refId_key" ON "SearchIndex"("kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchConfig_ownerOrgId_key" ON "SearchConfig"("ownerOrgId");

-- Full-text (GIN over the generated tsvector).
CREATE INDEX "SearchIndex_tsv_idx" ON "SearchIndex" USING gin ("tsv");

-- Fuzzy title matching (pg_trgm).
CREATE INDEX "SearchIndex_title_trgm_idx" ON "SearchIndex" USING gin ("title" gin_trgm_ops);

-- Semantic ANN (pgvector HNSW, cosine). Rows with NULL embedding are simply
-- absent from this index until embedded.
CREATE INDEX "SearchIndex_embedding_hnsw_idx" ON "SearchIndex" USING hnsw ("embedding" vector_cosine_ops);
