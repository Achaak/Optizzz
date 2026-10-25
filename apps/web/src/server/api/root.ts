import { playersRouter } from "~/server/api/routers/players";
import { spacesRouter } from "~/server/api/routers/spaces";
import { createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({ players: playersRouter, spaces: spacesRouter });

export type AppRouter = typeof appRouter;
