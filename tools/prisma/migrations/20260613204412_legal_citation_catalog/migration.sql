-- CreateTable
CREATE TABLE "LegalCitation" (
    "id" TEXT NOT NULL,
    "act" TEXT NOT NULL,
    "actShort" TEXT,
    "section" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fullText" TEXT,
    "externalUrl" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "supersedes" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'moderate',
    "verifyNote" TEXT,
    "topics" TEXT[],
    "appliesTo" TEXT[],
    "commonlyPairedWith" TEXT[],
    "draftingTips" TEXT,
    "jurisdiction" TEXT NOT NULL DEFAULT 'IN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "ownerOrgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalCitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalCitation_jurisdiction_isActive_idx" ON "LegalCitation"("jurisdiction", "isActive");

-- CreateIndex
CREATE INDEX "LegalCitation_ownerOrgId_idx" ON "LegalCitation"("ownerOrgId");

-- CreateIndex
CREATE INDEX "LegalCitation_isPublic_idx" ON "LegalCitation"("isPublic");
