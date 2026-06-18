-- Per-profile privacy default: mask monetary amounts on screen until revealed.
-- Defaults to true so the Wealth Vault doesn't show every amount by default.
ALTER TABLE "EstateProfile" ADD COLUMN "maskAmounts" BOOLEAN NOT NULL DEFAULT true;
