-- Cached parsed plaintext for full-text indexing of estate documents.
ALTER TABLE "AssetDocument" ADD COLUMN "searchText" TEXT;
