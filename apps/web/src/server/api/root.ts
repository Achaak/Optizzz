import { alliancesRouter } from "~/server/api/routers/alliances";
import { demandesRouter } from "~/server/api/routers/demandes";
import { envoisRouter } from "~/server/api/routers/envois";
import { playersRouter } from "~/server/api/routers/players";
import { spacesRouter } from "~/server/api/routers/spaces";
import { createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  players: playersRouter,
  alliances: alliancesRouter,
  spaces: spacesRouter,
  envois: envoisRouter,
  demandes: demandesRouter,
});

export type AppRouter = typeof appRouter;
