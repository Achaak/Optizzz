"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import SuperJSON from "superjson";
import type { AppRouter } from "~/server/api/root";

export const api = createTRPCReact<AppRouter>();

/** The client side of tRPC, for the few parts of the site that query as the visitor types. */
export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } }));
  const [trpcClient] = useState(() =>
    api.createClient({ links: [httpBatchLink({ transformer: SuperJSON, url: "/api/trpc" })] }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}
