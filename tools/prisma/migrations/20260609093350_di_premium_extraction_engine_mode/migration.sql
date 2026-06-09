-- CreateEnum
CREATE TYPE "ExtractionEngineMode" AS ENUM ('auto', 'native', 'vlm', 'agentic');

-- AlterEnum
ALTER TYPE "Feature" ADD VALUE 'premium_extraction';

-- AlterTable
ALTER TABLE "IntelligenceJob" ADD COLUMN     "engineMode" "ExtractionEngineMode" NOT NULL DEFAULT 'auto',
ADD COLUMN     "engineUsed" TEXT;
