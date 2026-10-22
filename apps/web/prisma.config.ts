import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Unset (a fresh clone, `prisma generate` alone), only the commands that reach the database fail.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
