-- AlterTable
ALTER TABLE "Workflow" ADD COLUMN     "documentTypeName" TEXT,
ADD COLUMN     "erpCreatedAt" TIMESTAMP(3),
ADD COLUMN     "label" TEXT,
ADD COLUMN     "originator" TEXT,
ADD COLUMN     "trackingStatus" TEXT;

-- AlterTable
ALTER TABLE "Workitem" ADD COLUMN     "description" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "erpStatus" TEXT,
ADD COLUMN     "subject" TEXT;
