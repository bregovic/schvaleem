-- CreateEnum
CREATE TYPE "CheckType" AS ENUM ('BANK_ACCOUNT_CZ', 'ICO_CZ', 'IBAN', 'DIC_CZ');

-- AlterTable
ALTER TABLE "FieldConfig" ADD COLUMN     "preview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Workitem" ADD COLUMN     "deferredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CheckConfig" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "type" "CheckType" NOT NULL,
    "jsonKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CheckConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckConfig_configId_idx" ON "CheckConfig"("configId");

-- AddForeignKey
ALTER TABLE "CheckConfig" ADD CONSTRAINT "CheckConfig_configId_fkey" FOREIGN KEY ("configId") REFERENCES "DocumentTypeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
