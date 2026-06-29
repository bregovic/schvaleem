-- AlterEnum
ALTER TYPE "CheckType" ADD VALUE 'ARES_SUBJECT';
ALTER TYPE "CheckType" ADD VALUE 'VAT_RELIABILITY';
ALTER TYPE "CheckType" ADD VALUE 'VAT_ACCOUNT_PUBLISHED';
ALTER TYPE "CheckType" ADD VALUE 'INSOLVENCY';

-- CreateTable
CREATE TABLE "RegistryCache" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ok" BOOLEAN,
    "result" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistryCache_kind_key_key" ON "RegistryCache"("kind", "key");
