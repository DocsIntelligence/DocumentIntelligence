-- AlterEnum
ALTER TYPE "PipelineRunStatus" ADD VALUE 'archived';

-- AlterEnum
ALTER TYPE "PipelineStageType" ADD VALUE 'filter';

-- AlterTable
ALTER TABLE "PipelineRun" ADD COLUMN     "archivedReason" TEXT,
ADD COLUMN     "documentTypeKey" TEXT;
