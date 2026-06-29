import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Schéma se řídí přes ?schema=schvaleem v DATABASE_URL,
    // aby migrace nezasáhly schémata dms / public ve sdílené DB.
    url: process.env["DATABASE_URL"],
  },
});
