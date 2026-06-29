import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 vyžaduje driver adapter. Naše tabulky žijí ve schématu "schvaleem"
// (sdílená Railway DB s projektem DMS – jeho schéma "dms" se nesmí dotknout).
const connectionString = process.env.DATABASE_URL;

const createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString }, { schema: "schvaleem" });
  return new PrismaClient({ adapter });
};

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
