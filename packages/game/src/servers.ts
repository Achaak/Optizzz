// The game's servers that publish the public exports — see docs/research/fourmizzz-api-exports.md.

export interface GameServer {
  /** « s5 », as in the address and the site's paths. */
  id: string;
  /** « S5 », as the game names it. */
  name: string;
  /** S1–S4 answer over HTTP only. */
  origin: string;
}

/** Checked on 2026-10-22: S6 and beyond do not answer. Add a server here and the site and its cron follow. */
export const SERVERS: readonly GameServer[] = [
  { id: "s1", name: "S1", origin: "http://s1.fourmizzz.fr" },
  { id: "s2", name: "S2", origin: "http://s2.fourmizzz.fr" },
  { id: "s3", name: "S3", origin: "http://s3.fourmizzz.fr" },
  { id: "s4", name: "S4", origin: "http://s4.fourmizzz.fr" },
  { id: "s5", name: "S5", origin: "https://s5.fourmizzz.fr" },
];

/** The server of a path segment, any case (« S5 », « s5 »). */
export function serverById(id: string): GameServer | undefined {
  const lower = id.toLowerCase();
  return SERVERS.find((server) => server.id === lower);
}
