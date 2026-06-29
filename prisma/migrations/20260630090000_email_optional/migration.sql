-- Email nepovinný (přihlášení i přes ERP userId)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
