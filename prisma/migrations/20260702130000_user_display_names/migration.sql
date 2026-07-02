-- Reálná jména uživatelů z ERP (UserInfo) vedle jejich ID
ALTER TABLE "Workflow" ADD COLUMN "originatorName" TEXT;
ALTER TABLE "Workitem" ADD COLUMN "assigneeName" TEXT;
