// What a server map needs, in columns: the site serves it (`/api/[server]/carte`), the site's map and the extension's
// read it — see docs/features/site-carte.md. About 1 MB compressed for S4's 216 000 players, against 44 MB of export.
import { allianceSchema, type Alliance, type Player } from "@optizzz/game/exports";
import { z } from "zod";

const column = <T extends z.ZodType>(item: T) => z.array(item);

export const mapDataSchema = z.object({
  /** Players export version, AAAAMMJJHHmm. */
  version: z.string(),
  players: z.object({
    id: column(z.number().int()),
    pseudo: column(z.string()),
    alliance: column(z.string().nullable()),
    master: column(z.number().int().nullable()),
    x: column(z.number().int()),
    y: column(z.number().int()),
    field: column(z.number()),
    building: column(z.number()),
    technology: column(z.number()),
    /** 1 on holiday. */
    holiday: column(z.union([z.literal(0), z.literal(1)])),
  }),
  alliances: z.array(allianceSchema),
});

export type MapData = z.infer<typeof mapDataSchema>;

/** The map's columns, the banned left out (the map never draws them). */
export function encodeMapData(version: string, players: readonly Player[], alliances: readonly Alliance[]): MapData {
  const shown = players.filter((player) => !player.isBanned);
  return {
    version,
    players: {
      id: shown.map((player) => player.id),
      pseudo: shown.map((player) => player.pseudo),
      alliance: shown.map((player) => player.alliance),
      master: shown.map((player) => player.masterPlayerId),
      x: shown.map((player) => player.x),
      y: shown.map((player) => player.y),
      field: shown.map((player) => player.field),
      building: shown.map((player) => player.buildingScore),
      technology: shown.map((player) => player.technologyScore),
      holiday: shown.map((player) => (player.onHoliday ? 1 : 0)),
    },
    alliances: [...alliances],
  };
}

/**
 * Players and alliances back from the columns. What the map does not use is left at its neutral value: no grade,
 * no Combat score, none banned.
 */
export function decodeMapData(data: MapData): { version: string; players: Player[]; alliances: Alliance[] } {
  const { players: columns } = data;
  const players = columns.id.map((id, i): Player => ({
    id,
    pseudo: columns.pseudo[i] ?? "",
    alliance: columns.alliance[i] ?? null,
    masterPlayerId: columns.master[i] ?? null,
    x: columns.x[i] ?? 0,
    y: columns.y[i] ?? 0,
    field: columns.field[i] ?? 0,
    grade: null,
    buildingScore: columns.building[i] ?? 0,
    technologyScore: columns.technology[i] ?? 0,
    trophyScore: 0,
    onHoliday: columns.holiday[i] === 1,
    isBanned: false,
  }));
  return { version: data.version, players, alliances: data.alliances };
}
