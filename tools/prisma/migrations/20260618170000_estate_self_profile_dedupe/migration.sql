-- Estate multi-profile: collapse duplicate "self" profiles, then guarantee
-- one-self-per-user at the DB level.
--
-- Why: ensureSelf() used a non-atomic findFirst-then-create, so two concurrent
-- /estate/* requests (the new profile-switcher fires several on load; React
-- StrictMode double-invokes in dev) could each see "no self profile" and both
-- insert one. This migration repairs any duplicates already created and adds a
-- partial unique index so it can never happen again.

-- 1. Map each duplicate self profile -> the kept (oldest) self profile per owner.
CREATE TEMP TABLE _self_dupe_map AS
SELECT r.id AS dupe_id, k.keep_id AS keep_id
FROM (
  SELECT id, "ownerUserId",
         row_number() OVER (
           PARTITION BY "ownerUserId" ORDER BY "createdAt" ASC, id ASC
         ) AS rn
  FROM "EstateProfile"
  WHERE "isSelf" = true
) r
JOIN (
  SELECT "ownerUserId", id AS keep_id
  FROM (
    SELECT id, "ownerUserId",
           row_number() OVER (
             PARTITION BY "ownerUserId" ORDER BY "createdAt" ASC, id ASC
           ) AS rn
    FROM "EstateProfile"
    WHERE "isSelf" = true
  ) x
  WHERE x.rn = 1
) k ON k."ownerUserId" = r."ownerUserId"
WHERE r.rn > 1;

-- 2. Re-point any child rows on the duplicates onto the kept self profile.
UPDATE "Asset" t          SET "profileId" = m.keep_id FROM _self_dupe_map m WHERE t."profileId" = m.dupe_id;
UPDATE "Nominee" t        SET "profileId" = m.keep_id FROM _self_dupe_map m WHERE t."profileId" = m.dupe_id;
UPDATE "WealthSnapshot" t SET "profileId" = m.keep_id FROM _self_dupe_map m WHERE t."profileId" = m.dupe_id;
UPDATE "ReleaseGrant" t   SET "profileId" = m.keep_id FROM _self_dupe_map m WHERE t."profileId" = m.dupe_id;

-- 3. Move access grants off the duplicates (drop ones that would collide with an
--    existing (keep_id, userId) row, then re-point the rest).
DELETE FROM "EstateProfileAccess" a
USING _self_dupe_map m
WHERE a."profileId" = m.dupe_id
  AND EXISTS (
    SELECT 1 FROM "EstateProfileAccess" b
    WHERE b."profileId" = m.keep_id AND b."userId" = a."userId"
  );
UPDATE "EstateProfileAccess" a
SET "profileId" = m.keep_id
FROM _self_dupe_map m
WHERE a."profileId" = m.dupe_id;

-- 4. Delete the duplicate self profiles (their access rows cascade).
DELETE FROM "EstateProfile" p USING _self_dupe_map m WHERE p.id = m.dupe_id;

DROP TABLE _self_dupe_map;

-- 5. Enforce at most one self profile per user. Partial unique index — only
--    rows with isSelf = true participate, so a user may still own many non-self
--    profiles.
CREATE UNIQUE INDEX "EstateProfile_ownerUserId_self_key"
  ON "EstateProfile" ("ownerUserId")
  WHERE "isSelf" = true;
