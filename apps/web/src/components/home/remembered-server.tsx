"use client";

import type { ReactNode } from "react";
import { useCurrentServer } from "~/components/server-picker";

/** Of the servers' blocks rendered on the server, the one of the server this browser last visited, else `fallback`. */
export function RememberedServer({ blocks, fallback }: { blocks: Record<string, ReactNode>; fallback: string }) {
  const { server } = useCurrentServer();
  return blocks[server && server.id in blocks ? server.id : fallback] ?? null;
}
