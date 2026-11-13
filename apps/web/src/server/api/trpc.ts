// tRPC on the site: the context gives each procedure the database. Public procedures need no account; protected ones
// (the Alliance Spaces) take the signed-in account from the session cookie, without extending it.
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { publicMessage } from "./limits";

export const createTRPCContext = (opts: { headers: Headers }) => ({ db, ...opts });

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    message: publicMessage(error.code, shape.message),
    data: { ...shape.data, zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null },
  }),
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/** A procedure for the signed-in account: `ctx.userId`. */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: ctx.headers, query: { disableRefresh: true } });
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Connectez-vous à votre Compte Optizzz." });
  return next({ ctx: { ...ctx, userId: session.user.id } });
});
