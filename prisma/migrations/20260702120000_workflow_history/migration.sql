-- Průběh schvalování z ERP (kroky + komentáře): [{ type, user, at, comment }]
ALTER TABLE "Workflow" ADD COLUMN "history" JSONB;
