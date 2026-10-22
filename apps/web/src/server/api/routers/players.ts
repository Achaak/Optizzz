import { SERVERS } from "@optizzz/game/servers";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/** Servers in the order of the menu, for the results. */
const ORDER = new Map(SERVERS.map((server, index) => [server.id, index]));

export const playersRouter = createTRPCRouter({
  /** The header's search: players whose pseudo starts with `q`, on every server. */
  search: publicProcedure.input(z.object({ q: z.string().trim().min(2).max(40) })).query(async ({ ctx, input }) => {
    const players = await ctx.db.player.findMany({
      where: { pseudo: { startsWith: input.q, mode: "insensitive" } },
      select: { server: true, id: true, pseudo: true, alliance: true },
      orderBy: { field: "desc" },
      take: 10,
    });
    return players.sort((a, b) => (ORDER.get(a.server) ?? 0) - (ORDER.get(b.server) ?? 0));
  }),
});
