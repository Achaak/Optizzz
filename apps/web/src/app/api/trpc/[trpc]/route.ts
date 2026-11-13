import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { env } from "~/env";
import { MAX_BATCH, tooLarge } from "~/server/api/limits";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

const handler = (req: NextRequest) =>
  tooLarge(req)
    ? new Response(null, { status: 413 })
    : fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: () => createTRPCContext({ headers: req.headers }),
        maxBatchSize: MAX_BATCH,
        // What the person did wrong is theirs to read; only what the site did not expect is logged.
        onError: ({ path, error }) => {
          if (env.NODE_ENV === "development" || error.code === "INTERNAL_SERVER_ERROR")
            console.error(`tRPC failed on ${path ?? "<no-path>"}: ${error.message}`, error.cause ?? "");
        },
      });

export { handler as GET, handler as POST };
