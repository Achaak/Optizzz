import { SERVERS, serverById } from "@optizzz/game/servers";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/** Servers in the order of the menu, for the results. */
const ORDER = new Map(SERVERS.map((server, index) => [server.id, index]));

const serverId = z.string().refine((id) => serverById(id)?.id === id, "Unknown server");

/** What a search and the tools' player picker show and use: position and hunting field (TDC) included. */
const PICKED = { server: true, id: true, pseudo: true, alliance: true, x: true, y: true, field: true } as const;

export const playersRouter = createTRPCRouter({
  /**
   * Players whose pseudo starts with `q`: on every server for the header's search, on `server` alone for the tools'
   * player picker.
   */
  search: publicProcedure
    .input(z.object({ q: z.string().trim().min(2).max(40), server: serverId.optional() }))
    .query(async ({ ctx, input }) => {
      const players = await ctx.db.player.findMany({
        where: { pseudo: { startsWith: input.q, mode: "insensitive" }, ...(input.server && { server: input.server }) },
        select: PICKED,
        orderBy: { field: "desc" },
        take: 10,
      });
      return players.sort((a, b) => (ORDER.get(a.server) ?? 0) - (ORDER.get(b.server) ?? 0));
    }),

  /** A player chosen earlier (a tool's link keeps the id), as the latest export shows them; null once gone. */
  byId: publicProcedure
    .input(z.object({ server: serverId, id: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      ctx.db.player.findUnique({ where: { server_id: { server: input.server, id: input.id } }, select: PICKED }),
    ),

  /**
   * The members of the alliances `tags` (as the export writes them), banned players left out: the travel tool towards
   * alliances. Ten alliances at most, about 2,000 members.
   */
  byAlliances: publicProcedure
    .input(z.object({ server: serverId, tags: z.array(z.string().min(1).max(20)).min(1).max(10) }))
    .query(({ ctx, input }) =>
      ctx.db.player.findMany({
        where: { server: input.server, alliance: { in: input.tags }, isBanned: false },
        select: { id: true, pseudo: true, alliance: true, x: true, y: true, field: true, onHoliday: true },
      }),
    ),

  /** A player's card on the signed-in home: TDC, its move in a week, rank on the server; null once gone. */
  card: publicProcedure
    .input(z.object({ server: serverId, id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { server_id: { server: input.server, id: input.id } },
        select: PICKED,
      });
      if (!player) return null;
      const [above, days] = await Promise.all([
        ctx.db.player.count({ where: { server: input.server, field: { gt: player.field } } }),
        ctx.db.playerDay.findMany({
          where: { server: input.server, playerId: input.id },
          orderBy: { day: "desc" },
          take: 8,
          select: { field: true },
        }),
      ]);
      return { ...player, rank: above + 1, weekAgo: days.length === 8 ? days[7]?.field : undefined };
    }),
});
