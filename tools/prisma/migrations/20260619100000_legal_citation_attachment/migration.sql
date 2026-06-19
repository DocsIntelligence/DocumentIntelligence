-- Files attached to a legal citation (bare-act PDF, commentary, judgment,
-- circular). Bytes live in object storage (StorageService); only the key +
-- metadata are persisted here. Public files surface on the /law/:id page.
-- Drift-safe (IF NOT EXISTS) so it can apply over a DB seeded by a prior dev run.

CREATE TABLE IF NOT EXISTS "LegalCitationAttachment" (
    "id" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "s3Key" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalCitationAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegalCitationAttachment_citationId_idx" ON "LegalCitationAttachment"("citationId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'LegalCitationAttachment_citationId_fkey'
    ) THEN
        ALTER TABLE "LegalCitationAttachment"
            ADD CONSTRAINT "LegalCitationAttachment_citationId_fkey"
            FOREIGN KEY ("citationId") REFERENCES "LegalCitation"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
