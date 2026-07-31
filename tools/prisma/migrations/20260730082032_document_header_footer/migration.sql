-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "headerText" TEXT;

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "footerText" TEXT,
ADD COLUMN     "headerText" TEXT;
