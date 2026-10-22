// Schemas of the public exports API — see docs/research/fourmizzz-api-exports.md.
import { z } from "zod";

// No `new Function` probing: extension pages forbid eval, and store reviewers flag it.
z.config({ jitless: true });

export const playerSchema = z.object({
  id: z.number().int(),
  pseudo: z.string(),
  alliance: z.string().nullable(),
  masterPlayerId: z.number().int().nullable(),
  x: z.number().int(),
  y: z.number().int(),
  field: z.number(),
  grade: z.string().nullable(),
  buildingScore: z.number(),
  technologyScore: z.number(),
  trophyScore: z.number(),
  onHoliday: z.boolean(),
  isBanned: z.boolean(),
});

export type Player = z.infer<typeof playerSchema>;

export const allianceSchema = z.object({
  tag: z.string(),
  name: z.string(),
  playersCount: z.number().int(),
  totalField: z.number(),
  totalBuildingScore: z.number(),
  totalTechnologyScore: z.number(),
  totalTrophyScore: z.number(),
  diplomacy: z.object({
    /** `name` is the kind of pact (« PNA », « Total »), not an alliance name. */
    pacts: z.array(z.object({ tag: z.string(), name: z.string(), description: z.string() })),
    wars: z.array(z.string()),
  }),
});

export type Alliance = z.infer<typeof allianceSchema>;

/** `GET /api/exports/`: the published versions, latest first. */
export const versionsSchema = z.object({ players: z.array(z.string()), alliances: z.array(z.string()) });

export type ExportKind = "players" | "alliances";

/** Address of an export of `origin` (e.g. "https://s5.fourmizzz.fr"); the list of versions without `kind`. */
export function exportUrl(origin: string, kind?: ExportKind, version?: string): string {
  if (!kind) return `${origin}/api/exports/`;
  return `${origin}/api/exports/${kind}/${version ? `?version=${version}` : ""}`;
}
