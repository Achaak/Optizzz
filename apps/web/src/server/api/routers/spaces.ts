// The Alliance Spaces for the signed-in account (src/server/spaces/space-service.ts holds the rules). The site only
// ever receives what browsers sealed and signed: public keys, locked private keys, sealed Clés d'alliance, certificates
// and the encrypted trust list.
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { SpaceError } from "~/server/spaces/space-service";
import { spaces } from "~/server/spaces/service";

const CODES = {
  "not-found": "NOT_FOUND",
  forbidden: "FORBIDDEN",
  invalid: "BAD_REQUEST",
  conflict: "CONFLICT",
} as const;

/** The rules' refusals, with their French message, as tRPC errors. */
async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof SpaceError) throw new TRPCError({ code: CODES[error.code], message: error.message });
    throw error;
  }
}

const text = (max: number) => z.string().max(max);
const keyInput = z.object({ publicKey: text(64), lockedPrivateKey: text(200) });
const sealed = z.array(z.object({ version: z.number().int(), sealed: text(300) })).max(1000);
const spaceId = z.object({ spaceId: text(64) });
const certificate = text(200);

export const spacesRouter = createTRPCRouter({
  key: protectedProcedure.query(({ ctx }) => run(() => spaces.key(ctx.userId))),
  createKey: protectedProcedure
    .input(keyInput)
    .mutation(({ ctx, input }) => run(() => spaces.createKey(ctx.userId, input))),
  changePassphrase: protectedProcedure
    .input(keyInput)
    .mutation(({ ctx, input }) => run(() => spaces.changePassphrase(ctx.userId, input))),
  forgetPassphrase: protectedProcedure
    .input(keyInput)
    .mutation(({ ctx, input }) => run(() => spaces.forgetPassphrase(ctx.userId, input))),
  saveTrustList: protectedProcedure
    .input(z.object({ trustList: text(1_000_000), expectedRevision: z.number().int() }))
    .mutation(({ ctx, input }) => run(() => spaces.saveTrustList(ctx.userId, input))),

  overview: protectedProcedure.query(({ ctx }) => run(() => spaces.overview(ctx.userId))),
  view: protectedProcedure.input(spaceId).query(({ ctx, input }) => run(() => spaces.view(ctx.userId, input.spaceId))),
  create: protectedProcedure
    .input(z.object({ id: text(64), server: text(8), playerId: z.number().int(), name: text(200).optional(), sealed }))
    .mutation(({ ctx, input }) => run(() => spaces.createSpace(ctx.userId, input))),
  requestToJoin: protectedProcedure
    .input(spaceId.extend({ playerId: z.number().int() }))
    .mutation(({ ctx, input }) => run(() => spaces.requestToJoin(ctx.userId, input))),
  cancelRequest: protectedProcedure
    .input(spaceId)
    .mutation(({ ctx, input }) => run(() => spaces.cancelRequest(ctx.userId, input))),
  approve: protectedProcedure
    .input(spaceId.extend({ requestId: text(64), publicKey: text(64), sealed, certificate }))
    .mutation(({ ctx, input }) => run(() => spaces.approve(ctx.userId, input))),
  refuse: protectedProcedure
    .input(spaceId.extend({ requestId: text(64) }))
    .mutation(({ ctx, input }) => run(() => spaces.refuse(ctx.userId, input))),
  resend: protectedProcedure
    .input(spaceId.extend({ playerId: z.number().int(), publicKey: text(64), sealed, certificate }))
    .mutation(({ ctx, input }) => run(() => spaces.resend(ctx.userId, input))),
  setRole: protectedProcedure
    .input(
      spaceId.extend({
        playerId: z.number().int(),
        role: z.enum(["admin", "delegate", "member"]),
        certificate: certificate.optional(),
        certificates: z.array(certificate).max(50).optional(),
      }),
    )
    .mutation(({ ctx, input }) => run(() => spaces.setRole(ctx.userId, input))),
  addCertificates: protectedProcedure
    .input(spaceId.extend({ certificates: z.array(certificate).max(50) }))
    .mutation(({ ctx, input }) => run(() => spaces.addCertificates(ctx.userId, input))),
  leave: protectedProcedure.input(spaceId).mutation(({ ctx, input }) => run(() => spaces.leave(ctx.userId, input))),
  rename: protectedProcedure
    .input(spaceId.extend({ name: text(200) }))
    .mutation(({ ctx, input }) => run(() => spaces.rename(ctx.userId, input))),
  delete: protectedProcedure
    .input(spaceId.extend({ name: text(200) }))
    .mutation(({ ctx, input }) => run(() => spaces.deleteSpace(ctx.userId, input))),
});
