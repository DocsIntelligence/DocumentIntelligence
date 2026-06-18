-- Nominee KYC now lives in the linked Vault person entity (vaultEntityId) — drop
-- the duplicated columns. (No deployed data; these were added earlier the same day.)
ALTER TABLE "Nominee" DROP COLUMN IF EXISTS "dataEncrypted",
DROP COLUMN IF EXISTS "aadhaarMasked",
DROP COLUMN IF EXISTS "panMasked",
DROP COLUMN IF EXISTS "dob";
