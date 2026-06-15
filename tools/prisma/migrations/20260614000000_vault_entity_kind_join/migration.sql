-- Vault: switch from "field row per (entityKind, key)" to "global fields +
-- entity-kind table + join table". `pan` is now a single row used by
-- person/company/lawyer/other instead of being duplicated per kind.
--
-- Pre-launch reseed: the field + doc-kind catalogs are seeded from code on
-- first call to `VaultConfigService.ensureSeeded()`. We clear them here so
-- the new schema's seeder repopulates with the dedup'd shape on next boot.
-- Any org-scoped customisations are wiped — acceptable in this phase since
-- the catalog has only been auto-seeded so far.

-- 1. Clear catalog rows (system + any org overrides). User entity data on
--    VaultEntity.dataEncrypted is untouched (it's keyed by field.key,
--    which stays stable).
DELETE FROM "VaultFieldConfig";
DELETE FROM "VaultDocKindConfig";

-- 2. Drop the entity-kind column + old composite index on field config.
DROP INDEX IF EXISTS "VaultFieldConfig_ownerOrgId_entityKind_sortOrder_idx";
ALTER TABLE "VaultFieldConfig" DROP COLUMN IF EXISTS "entityKind";
ALTER TABLE "VaultFieldConfig" DROP COLUMN IF EXISTS "sortOrder";

-- 3. New unique constraint: (ownerOrgId, key) — one canonical field per key
--    within an org (system kept at ownerOrgId = NULL).
CREATE UNIQUE INDEX "VaultFieldConfig_ownerOrgId_key_key"
  ON "VaultFieldConfig"("ownerOrgId", "key");
CREATE INDEX "VaultFieldConfig_ownerOrgId_idx"
  ON "VaultFieldConfig"("ownerOrgId");

-- 4. New entity-kind table.
CREATE TABLE "VaultEntityKindConfig" (
  "id"           TEXT      NOT NULL,
  "ownerOrgId"   TEXT,
  "key"          TEXT      NOT NULL,
  "label"        TEXT      NOT NULL,
  "badgeVariant" TEXT      NOT NULL DEFAULT 'secondary',
  "sortOrder"    INTEGER   NOT NULL DEFAULT 0,
  "isSystem"     BOOLEAN   NOT NULL DEFAULT false,
  "isActive"     BOOLEAN   NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VaultEntityKindConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultEntityKindConfig_ownerOrgId_key_key"
  ON "VaultEntityKindConfig"("ownerOrgId", "key");
CREATE INDEX "VaultEntityKindConfig_ownerOrgId_sortOrder_idx"
  ON "VaultEntityKindConfig"("ownerOrgId", "sortOrder");

-- 5. Join: which fields each entity kind exposes, in what order, with an
--    optional per-kind group override.
CREATE TABLE "VaultEntityKindField" (
  "id"             TEXT      NOT NULL,
  "entityKindId"   TEXT      NOT NULL,
  "fieldId"        TEXT      NOT NULL,
  "sortOrder"      INTEGER   NOT NULL DEFAULT 0,
  "groupOverride"  TEXT,
  "isActive"       BOOLEAN   NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VaultEntityKindField_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VaultEntityKindField_entityKindId_fieldId_key"
  ON "VaultEntityKindField"("entityKindId", "fieldId");
CREATE INDEX "VaultEntityKindField_entityKindId_sortOrder_idx"
  ON "VaultEntityKindField"("entityKindId", "sortOrder");

ALTER TABLE "VaultEntityKindField"
  ADD CONSTRAINT "VaultEntityKindField_entityKindId_fkey"
  FOREIGN KEY ("entityKindId") REFERENCES "VaultEntityKindConfig"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VaultEntityKindField"
  ADD CONSTRAINT "VaultEntityKindField_fieldId_fkey"
  FOREIGN KEY ("fieldId") REFERENCES "VaultFieldConfig"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
