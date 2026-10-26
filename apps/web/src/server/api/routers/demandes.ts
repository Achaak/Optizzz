// The Demandes of a space for its signed-in members (src/server/demandes/demande-service.ts holds the rules): what
// they ask for stays encrypted, opened by the page with the Clé d'alliance.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { DemandeError } from "~/server/demandes/demande-service";
import { demandes } from "~/server/demandes/service";

const CODES = {
  invalid: "BAD_REQUEST",
  forbidden: "FORBIDDEN",
  "not-found": "NOT_FOUND",
  "stale-key": "CONFLICT",
  "needs-envois": "PRECONDITION_FAILED",
  conflict: "CONFLICT",
} as const;

async function rules<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof DemandeError) throw new TRPCError({ code: CODES[error.code], message: error.message });
    throw error;
  }
}

const player = { server: z.string().max(8), playerId: z.number().int() };

export const demandesRouter = createTRPCRouter({
  space: protectedProcedure
    .input(z.object({ spaceId: z.string().max(64) }))
    .query(({ ctx, input }) => rules(() => demandes.read(ctx.userId, { spaceId: input.spaceId, scope: "page" }))),
  create: protectedProcedure
    .input(z.object({ ...player, id: z.string().max(64), blob: z.string().max(8000), keyVersion: z.number().int() }))
    .mutation(({ ctx, input }) => rules(() => demandes.create(ctx.userId, input))),
  decide: protectedProcedure
    .input(z.object({ id: z.string().max(64), decision: z.enum(["validated", "refused"]) }))
    .mutation(({ ctx, input }) => rules(() => demandes.decide(ctx.userId, input))),
  cancel: protectedProcedure
    .input(z.object({ id: z.string().max(64) }))
    .mutation(({ ctx, input }) => rules(() => demandes.cancel(ctx.userId, input))),
  reorder: protectedProcedure
    .input(z.object({ ...player, ids: z.array(z.string().max(64)).max(20) }))
    .mutation(({ ctx, input }) => rules(() => demandes.reorder(ctx.userId, input))),
});
