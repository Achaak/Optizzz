import { envoisRouter } from "~/server/api/routers/envois";
import { playersRouter } from "~/server/api/routers/players";
import { spacesRouter } from "~/server/api/routers/spaces";
import { createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({ players: playersRouter, spaces: spacesRouter, envois: envoisRouter });

export type AppRouter = typeof appRouter;
