import { serverById } from "@optizzz/game/servers";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const serverId = z.string().refine((id) => serverById(id)?.id === id, "Unknown server");

export const alliancesRouter = createTRPCRouter({
  /** Alliances of `server` whose tag or name starts with `q`, the biggest first: the travel tool's choice of alliances. */
  search: publicProcedure
    .input(z.object({ server: serverId, q: z.string().trim().min(1).max(40) }))
    .query(({ ctx, input }) =>
      ctx.db.alliance.findMany({
        where: {
          server: input.server,
          OR: [
            { tag: { startsWith: input.q, mode: "insensitive" } },
            { name: { startsWith: input.q, mode: "insensitive" } },
          ],
        },
        select: { tag: true, name: true, playersCount: true },
        orderBy: { totalField: "desc" },
        take: 10,
      }),
    ),
});
