import { playersRouter } from "~/server/api/routers/players";
import { createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({ players: playersRouter });

export type AppRouter = typeof appRouter;
