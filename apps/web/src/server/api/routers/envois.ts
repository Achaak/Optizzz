// The Envois of a space for its signed-in members (src/server/envois/envoi-service.ts holds the rules): encrypted rows
// the page opens in the browser with the Clé d'alliance, what each member sends, and the newest key version.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { EnvoiError } from "~/server/envois/envoi-service";
import { envois } from "~/server/envois/service";

const CODES = {
  invalid: "BAD_REQUEST",
  forbidden: "FORBIDDEN",
  "not-found": "NOT_FOUND",
  "stale-key": "CONFLICT",
  "category-off": "CONFLICT",
} as const;

export const envoisRouter = createTRPCRouter({
  space: protectedProcedure
    .input(z.object({ spaceId: z.string().max(64), since: z.number().int().nonnegative().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        return await envois.readEnvois(ctx.userId, input);
      } catch (error) {
        if (error instanceof EnvoiError) throw new TRPCError({ code: CODES[error.code], message: error.message });
        throw error;
      }
    }),
});
