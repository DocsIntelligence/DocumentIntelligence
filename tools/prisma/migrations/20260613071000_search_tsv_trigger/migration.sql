-- Convert SearchIndex.tsv from a GENERATED column to a trigger-maintained one.
--
-- Prisma treats a generated column's expression as a column DEFAULT and emits an
-- invalid `ALTER COLUMN "tsv" DROP DEFAULT` on every `migrate dev` — which fails
-- on a generated column (P3006 on the shadow DB / P3018 on apply) and can't even
-- be auto-pruned because generation aborts. A trigger is invisible to Prisma, so
-- this drift disappears entirely; only the (valid) DROP INDEX drift remains,
-- which `tools/scripts/prisma-migrate-dev.mjs` strips automatically.
SET search_path TO "starter", public;

-- Drop the generated expression — keeps the column and its current values.
ALTER TABLE "SearchIndex" ALTER COLUMN "tsv" DROP EXPRESSION;

-- Recompute tsv on write (identical weighting to the old generated expression:
-- title weighted 'A', body 'B').
CREATE OR REPLACE FUNCTION searchindex_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW."tsv" :=
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."bodyText", '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS searchindex_tsv_trigger ON "SearchIndex";
CREATE TRIGGER searchindex_tsv_trigger
  BEFORE INSERT OR UPDATE OF "title", "bodyText" ON "SearchIndex"
  FOR EACH ROW EXECUTE FUNCTION searchindex_tsv_update();
