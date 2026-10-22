import { serverById, type GameServer } from "@optizzz/game/servers";
import { notFound, permanentRedirect } from "next/navigation";

/** The server of a `[server]` path segment; « /S5/… » goes to « /s5/… », an unknown server is a 404. */
export function serverOfPath(segment: string, rest = ""): GameServer {
  const server = serverById(segment);
  if (!server) notFound();
  if (segment !== server.id) permanentRedirect(`/${server.id}${rest}`);
  return server;
}

/** A page number from the query, 1 when missing or wrong. */
export function pageOf(value: string | string[] | undefined): number {
  const page = Number(typeof value === "string" ? value : 1);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** A text from the query, trimmed, empty when missing. */
export function textOf(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim().slice(0, 40) : "";
}

/** One of `choices` from the query, the first one otherwise. */
export function choiceOf<T extends string>(value: string | string[] | undefined, choices: readonly [T, ...T[]]): T {
  return choices.find((choice) => choice === value) ?? choices[0];
}
