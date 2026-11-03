import { SERVERS, serverById } from "@optizzz/game/servers";
import { z } from "zod";
import { columnDay } from "~/ingest/days";
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

  /**
   * The Équilibre of a space (docs/features/site-envois.md): these players and those they colonize now, each with
   * their colonizer's pseudo and their TDC and alliance on each of the last `days` Paris days (nightly export). Public
   * data, as the curves of a player's page.
   */
  allianceDays: publicProcedure
    .input(
      z.object({
        server: serverId,
        ids: z.array(z.number().int().positive()).max(200),
        days: z.number().int().min(1).max(91),
      }),
    )
    .query(async ({ ctx, input }) => {
      const colonies = await ctx.db.player.findMany({
        where: { server: input.server, masterId: { in: input.ids } },
        select: { id: true },
      });
      const ids = [...new Set([...input.ids, ...colonies.map((c) => c.id)])];
      const players = await ctx.db.player.findMany({
        where: { server: input.server, id: { in: ids } },
        select: { id: true, pseudo: true, masterId: true },
      });
      const masterIds = players.flatMap((p) => (p.masterId === null ? [] : [p.masterId]));
      const masters = await ctx.db.player.findMany({
        where: { server: input.server, id: { in: masterIds } },
        select: { id: true, pseudo: true },
      });
      const since = new Date(Date.now() - (input.days + 1) * 24 * 3600_000);
      const days = await ctx.db.playerDay.findMany({
        where: { server: input.server, playerId: { in: ids }, day: { gte: since } },
        select: { playerId: true, day: true, field: true, alliance: true },
        orderBy: { day: "asc" },
      });
      return players.map((player) => ({
        id: player.id,
        pseudo: player.pseudo,
        master: masters.find((m) => m.id === player.masterId)?.pseudo ?? null,
        days: days
          .filter((d) => d.playerId === player.id)
          .map((d) => ({ day: columnDay(d.day), field: d.field, alliance: d.alliance })),
      }));
    }),
});
