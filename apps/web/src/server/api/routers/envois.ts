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

async function rules<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof EnvoiError) throw new TRPCError({ code: CODES[error.code], message: error.message });
    throw error;
  }
}

export const envoisRouter = createTRPCRouter({
  /**
   * A convoy its sender declares for a Demande, sealed on the page with the Clé d'alliance (or one they withdraw):
   * the only Envoi the page writes, under the member's own Joueur.
   */
  declareConvoy: protectedProcedure
    .input(
      z.object({
        server: z.string().max(8),
        playerId: z.number().int(),
        keyVersion: z.number().int(),
        items: z
          .array(z.object({ fingerprint: z.string().max(64), blob: z.string().max(8000), expiresAt: z.number() }))
          .max(1),
        removed: z.array(z.string().max(64)).max(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      rules(() => envois.saveEnvoi(ctx.userId, { ...input, category: "declared-convoys" })),
    ),
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
