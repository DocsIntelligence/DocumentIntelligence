-- Per-asset-type structured fields (non-secret, queryable). See Asset.details.
ALTER TABLE "Asset" ADD COLUMN "details" JSONB;
