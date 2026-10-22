import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Checked at build and start: set SKIP_ENV_VALIDATION to build without them (CI).
export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    /** Secret of the revalidation route, called by the cron once the exports are stored. */
    REVALIDATE_SECRET: z.string().min(16),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
