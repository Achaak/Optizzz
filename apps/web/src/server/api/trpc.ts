// tRPC on the site: the context gives each procedure the database. No account yet: every procedure is public.
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";
import { db } from "~/server/db";

export const createTRPCContext = (opts: { headers: Headers }) => ({ db, ...opts });

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: { ...shape.data, zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null },
  }),
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
