


-- CreateTable
CREATE TABLE "VaultFieldConfig" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "entityKind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "group" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "revealLast" INTEGER,
    "placeholder" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultDocKindConfig" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scannable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultDocKindConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultFieldConfig_ownerOrgId_entityKind_sortOrder_idx" ON "VaultFieldConfig"("ownerOrgId", "entityKind", "sortOrder");

-- CreateIndex
CREATE INDEX "VaultDocKindConfig_ownerOrgId_sortOrder_idx" ON "VaultDocKindConfig"("ownerOrgId", "sortOrder");
