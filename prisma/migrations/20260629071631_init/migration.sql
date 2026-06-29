-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "schvaleem";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'APPROVER');

-- CreateEnum
CREATE TYPE "FieldRole" AS ENUM ('TITLE', 'AMOUNT', 'CURRENCY', 'DETAIL', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ActionKind" AS ENUM ('APPROVE', 'REJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "ThresholdAction" AS ENUM ('NONE', 'REQUIRE_COMMENT', 'BLOCK');

-- CreateEnum
CREATE TYPE "WorkitemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED_BY_SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'APPROVER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "erpUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataArea" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTypeConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "requireCommentOnReject" BOOLEAN NOT NULL DEFAULT true,
    "requireCommentOnApprove" BOOLEAN NOT NULL DEFAULT false,
    "amountThreshold" DECIMAL(18,2),
    "thresholdAction" "ThresholdAction" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldConfig" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "jsonKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "role" "FieldRole" NOT NULL DEFAULT 'DETAIL',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionConfig" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "ActionKind" NOT NULL DEFAULT 'OTHER',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "erpWorkflowId" TEXT NOT NULL,
    "dataAreaCode" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "recordId" TEXT,
    "values" JSONB NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workitem" (
    "id" TEXT NOT NULL,
    "erpWorkitemId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "dataAreaCode" TEXT NOT NULL,
    "assigneeErpUserId" TEXT NOT NULL,
    "status" "WorkitemStatus" NOT NULL DEFAULT 'PENDING',
    "action" TEXT,
    "comment" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "deliveredToErpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workitem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "workflowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "apiKeyId" TEXT,
    "ip" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_erpUserId_key" ON "User"("erpUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DataArea_code_key" ON "DataArea"("code");

-- CreateIndex
CREATE INDEX "DataArea_organizationId_idx" ON "DataArea"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTypeConfig_organizationId_documentType_key" ON "DocumentTypeConfig"("organizationId", "documentType");

-- CreateIndex
CREATE INDEX "FieldConfig_configId_idx" ON "FieldConfig"("configId");

-- CreateIndex
CREATE INDEX "ActionConfig_configId_idx" ON "ActionConfig"("configId");

-- CreateIndex
CREATE INDEX "Workflow_documentType_idx" ON "Workflow"("documentType");

-- CreateIndex
CREATE INDEX "Workflow_organizationId_idx" ON "Workflow"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_erpWorkflowId_dataAreaCode_key" ON "Workflow"("erpWorkflowId", "dataAreaCode");

-- CreateIndex
CREATE UNIQUE INDEX "Workitem_erpWorkitemId_key" ON "Workitem"("erpWorkitemId");

-- CreateIndex
CREATE INDEX "Workitem_assigneeErpUserId_status_idx" ON "Workitem"("assigneeErpUserId", "status");

-- CreateIndex
CREATE INDEX "Workitem_workflowId_idx" ON "Workitem"("workflowId");

-- CreateIndex
CREATE INDEX "Document_workflowId_idx" ON "Document"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataArea" ADD CONSTRAINT "DataArea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTypeConfig" ADD CONSTRAINT "DocumentTypeConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldConfig" ADD CONSTRAINT "FieldConfig_configId_fkey" FOREIGN KEY ("configId") REFERENCES "DocumentTypeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionConfig" ADD CONSTRAINT "ActionConfig_configId_fkey" FOREIGN KEY ("configId") REFERENCES "DocumentTypeConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workitem" ADD CONSTRAINT "Workitem_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workitem" ADD CONSTRAINT "Workitem_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiLog" ADD CONSTRAINT "ApiLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

