// What the pages read from the database — see docs/features/site-public.md.
import "server-only";
import type { Change } from "@optizzz/game/changes";
import { versionDate } from "@optizzz/game/export-versions";
import type { JournalEntry, Prisma } from "~/generated/prisma/client";
import { bracketRange, FIELD_BRACKETS, journalGroupOf, type JournalGroup } from "~/lib/server-stats";
import { db } from "~/server/db";

export const PAGE_SIZE = 50;

/** A Journal line ready to show. */
export interface JournalLine {
  id: number;
  playerId: number | null;
  tag: string | null;
  name: string;
  at: Date;
  change: Change;
}

const toLine = (row: JournalEntry): JournalLine => ({
  id: row.id,
  playerId: row.playerId,
  tag: row.tag,
  name: row.name,
  at: row.at,
  change: row.change as Change,
});

/** The date of the export the pages show, null before the first pass of the cron. */
export async function lastReading(server: string): Promise<Date | null> {
  const read = await db.exportRead.findUnique({ where: { server_kind: { server, kind: "players" } } });
  return read ? versionDate(read.version) : null;
}

/** Players per server, for the home page. */
export async function playersPerServer(): Promise<Map<string, number>> {
  const counts = await db.player.groupBy({ by: ["server"], _count: { _all: true } });
  return new Map(counts.map((row) => [row.server, row._count._all]));
}

export async function serverSummary(server: string) {
  const [
    players,
    alliances,
    colonized,
    onHoliday,
    banned,
    field,
    topPlayers,
    topAlliances,
    perDay,
    journal,
    brackets,
    journalDays,
  ] = await Promise.all([
    db.player.count({ where: { server } }),
    db.alliance.count({ where: { server } }),
    db.player.count({ where: { server, masterId: { not: null } } }),
    db.player.count({ where: { server, onHoliday: true } }),
    db.player.count({ where: { server, isBanned: true } }),
    db.player.aggregate({ where: { server }, _sum: { field: true } }),
    db.player.findMany({ where: { server }, orderBy: { field: "desc" }, take: 10 }),
    db.alliance.findMany({ where: { server }, orderBy: { totalField: "desc" }, take: 10 }),
    db.playerDay.groupBy({
      by: ["day"],
      where: { server },
      _count: { _all: true },
      _sum: { field: true },
      orderBy: { day: "asc" },
    }),
    // The server's feed: arrivals and departures in an alliance already show as the players' Changes.
    db.journalEntry.findMany({
      where: {
        server,
        NOT: [{ change: { path: ["kind"], equals: "joined" } }, { change: { path: ["kind"], equals: "left" } }],
      },
      orderBy: { at: "desc" },
      take: 20,
    }),
    Promise.all(FIELD_BRACKETS.map((_, index) => db.player.count({ where: { server, field: bracketRange(index) } }))),
    journalPerDay(server),
  ]);
  return {
    players,
    alliances,
    colonized,
    onHoliday,
    banned,
    field: field._sum.field ?? 0,
    topPlayers,
    topAlliances,
    playersPerDay: perDay.map((row) => ({ day: row.day, players: row._count._all, field: row._sum.field ?? 0 })),
    journal: journal.map(toLine),
    brackets: FIELD_BRACKETS.map((bracket, index) => ({ label: bracket.label, players: brackets[index] ?? 0 })),
    journalDays,
  };
}

/** One Paris day of the Journal, its Changes counted by group. */
export type JournalDay = { day: Date } & Record<JournalGroup, number>;

/** The Journal's last 30 Paris days, oldest first; a day without a Change is missing. */
async function journalPerDay(server: string): Promise<JournalDay[]> {
  const rows = await db.$queryRaw<{ day: Date; kind: string | null; count: bigint }[]>`
    SELECT ((at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date AS day, change->>'kind' AS kind, count(*) AS count
    FROM "JournalEntry"
    WHERE server = ${server} AND at > now() - interval '30 days'
    GROUP BY 1, 2
    ORDER BY 1`;
  const days = new Map<number, JournalDay>();
  for (const row of rows) {
    const key = row.day.getTime();
    const day = days.get(key) ?? { day: row.day, players: 0, alliances: 0, colonies: 0, diplomacy: 0 };
    day[journalGroupOf(row.kind ?? "")] += Number(row.count);
    days.set(key, day);
  }
  return [...days.values()];
}

export type PlayerSort = "field" | "building" | "technology" | "trophy" | "pseudo";

const PLAYER_ORDER: Record<PlayerSort, Prisma.PlayerOrderByWithRelationInput> = {
  field: { field: "desc" },
  building: { buildingScore: "desc" },
  technology: { technologyScore: "desc" },
  trophy: { trophyScore: "desc" },
  pseudo: { pseudo: "asc" },
};

export async function listPlayers(
  server: string,
  { q, alliance, sort, page }: { q: string; alliance: string; sort: PlayerSort; page: number },
) {
  const where: Prisma.PlayerWhereInput = {
    server,
    ...(q && { pseudo: { contains: q, mode: "insensitive" } }),
    ...(alliance && { alliance: { equals: alliance, mode: "insensitive" } }),
  };
  const [total, players] = await Promise.all([
    db.player.count({ where }),
    db.player.findMany({
      where,
      orderBy: [PLAYER_ORDER[sort], { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, players };
}

export async function playerPage(server: string, id: number) {
  const player = await db.player.findUnique({ where: { server_id: { server, id } } });
  const [master, colonies, days, journal] = await Promise.all([
    player?.masterId ? db.player.findUnique({ where: { server_id: { server, id: player.masterId } } }) : null,
    db.player.findMany({ where: { server, masterId: id }, orderBy: { pseudo: "asc" } }),
    db.playerDay.findMany({ where: { server, playerId: id }, orderBy: { day: "asc" } }),
    db.journalEntry.findMany({ where: { server, playerId: id }, orderBy: { at: "desc" }, take: 100 }),
  ]);
  const [rank, ranks] = player
    ? await Promise.all([
        db.player.count({ where: { server, field: { gt: player.field } } }),
        db.$queryRaw<{ day: Date; rank: bigint }[]>`
          SELECT d.day, (SELECT count(*) FROM "PlayerDay" o WHERE o.server = d.server AND o.day = d.day AND o.field > d.field) + 1 AS rank
          FROM "PlayerDay" d
          WHERE d.server = ${server} AND d."playerId" = ${id}
          ORDER BY d.day`,
      ])
    : [null, []];
  return {
    player,
    master,
    colonies,
    days,
    journal: journal.map(toLine),
    /** By TDC on the server, 1 first. */
    rank: rank === null ? null : rank + 1,
    ranks: ranks.map((row) => ({ day: row.day, rank: Number(row.rank) })),
  };
}

export type AllianceSort = "field" | "members" | "building" | "technology" | "trophy" | "tag";

const ALLIANCE_ORDER: Record<AllianceSort, Prisma.AllianceOrderByWithRelationInput> = {
  field: { totalField: "desc" },
  members: { playersCount: "desc" },
  building: { totalBuildingScore: "desc" },
  technology: { totalTechnologyScore: "desc" },
  trophy: { totalTrophyScore: "desc" },
  tag: { tag: "asc" },
};

export async function listAlliances(
  server: string,
  { q, sort, page }: { q: string; sort: AllianceSort; page: number },
) {
  const where: Prisma.AllianceWhereInput = {
    server,
    ...(q && {
      OR: [{ tag: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
    }),
  };
  const [total, alliances] = await Promise.all([
    db.alliance.count({ where }),
    db.alliance.findMany({
      where,
      orderBy: [ALLIANCE_ORDER[sort], { tag: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, alliances };
}

/** The alliance `tag`, any case (the export's tags do not always share theirs). */
export function findAlliance(server: string, tag: string) {
  return db.alliance.findFirst({ where: { server, tag: { equals: tag, mode: "insensitive" } } });
}

/** `field` is the alliance's TDC now, for its rank among the server's alliances. */
export async function alliancePage(server: string, tag: string, field: number) {
  const [members, days, journal, ranks, above] = await Promise.all([
    db.player.findMany({ where: { server, alliance: tag }, orderBy: { field: "desc" } }),
    db.allianceDay.findMany({ where: { server, tag }, orderBy: { day: "asc" } }),
    db.journalEntry.findMany({ where: { server, tag }, orderBy: { at: "desc" }, take: 100 }),
    db.$queryRaw<{ day: Date; rank: bigint }[]>`
      SELECT d.day, (SELECT count(*) FROM "AllianceDay" o WHERE o.server = d.server AND o.day = d.day AND o."totalField" > d."totalField") + 1 AS rank
      FROM "AllianceDay" d
      WHERE d.server = ${server} AND d.tag = ${tag}
      ORDER BY d.day`,
    db.alliance.count({ where: { server, totalField: { gt: field } } }),
  ]);
  return {
    members,
    days,
    journal: journal.map(toLine),
    /** By TDC among the server's alliances, 1 first. */
    rank: above + 1,
    ranks: ranks.map((row) => ({ day: row.day, rank: Number(row.rank) })),
  };
}
