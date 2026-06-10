-- CreateTable
CREATE TABLE "ExtractionSchemaDef" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "documentTypeKey" TEXT,
    "description" TEXT,
    "jurisdiction" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionSchemaDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemaField" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "reviewMandatory" BOOLEAN NOT NULL DEFAULT false,
    "fieldThreshold" DOUBLE PRECISION,
    "description" TEXT,
    "example" TEXT,
    "format" TEXT,
    "config" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SchemaField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMapDef" (
    "id" TEXT NOT NULL,
    "ownerOrgId" TEXT,
    "schemaKey" TEXT NOT NULL,
    "documentTypeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldMapDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMapEntry" (
    "id" TEXT NOT NULL,
    "fieldMapId" TEXT NOT NULL,
    "extractionKey" TEXT NOT NULL,
    "bundlePath" TEXT NOT NULL,

    CONSTRAINT "FieldMapEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionSchemaDef_ownerOrgId_key_idx" ON "ExtractionSchemaDef"("ownerOrgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionSchemaDef_ownerOrgId_key_version_key" ON "ExtractionSchemaDef"("ownerOrgId", "key", "version");

-- CreateIndex
CREATE INDEX "SchemaField_schemaId_idx" ON "SchemaField"("schemaId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemaField_schemaId_key_key" ON "SchemaField"("schemaId", "key");

-- CreateIndex
CREATE INDEX "FieldMapDef_ownerOrgId_schemaKey_idx" ON "FieldMapDef"("ownerOrgId", "schemaKey");

-- CreateIndex
CREATE UNIQUE INDEX "FieldMapDef_ownerOrgId_schemaKey_version_key" ON "FieldMapDef"("ownerOrgId", "schemaKey", "version");

-- CreateIndex
CREATE INDEX "FieldMapEntry_fieldMapId_idx" ON "FieldMapEntry"("fieldMapId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldMapEntry_fieldMapId_extractionKey_key" ON "FieldMapEntry"("fieldMapId", "extractionKey");

-- AddForeignKey
ALTER TABLE "SchemaField" ADD CONSTRAINT "SchemaField_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "ExtractionSchemaDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldMapEntry" ADD CONSTRAINT "FieldMapEntry_fieldMapId_fkey" FOREIGN KEY ("fieldMapId") REFERENCES "FieldMapDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;
