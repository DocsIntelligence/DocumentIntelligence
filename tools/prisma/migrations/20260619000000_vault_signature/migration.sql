-- Reusable, encrypted-at-rest signatures saved against a Vault entity (docs/10).
-- Multiple per entity; payload (PNG data URL or typed text + font) is encrypted
-- exactly like VaultEntity.dataEncrypted. Drift-safe (IF NOT EXISTS) so it can be
-- applied over a DB that already has the table from a prior dev run.

CREATE TABLE IF NOT EXISTS "VaultSignature" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'draw',
    "label" TEXT NOT NULL DEFAULT 'Signature',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "dataEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VaultSignature_entityId_idx" ON "VaultSignature"("entityId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'VaultSignature_entityId_fkey'
    ) THEN
        ALTER TABLE "VaultSignature"
            ADD CONSTRAINT "VaultSignature_entityId_fkey"
            FOREIGN KEY ("entityId") REFERENCES "VaultEntity"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
