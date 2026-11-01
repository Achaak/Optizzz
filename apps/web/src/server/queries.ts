// What the pages read from the database — see docs/features/site-public.md.
import "server-only";
import type { Change } from "@optizzz/game/changes";
import { versionDate } from "@optizzz/game/export-versions";
import type { JournalEntry, Prisma } from "~/generated/prisma/client";
import type { CompareKind, CompareMetric } from "~/lib/compare";
import { bracketRange, FIELD_BRACKETS, journalGroupOf, kindsOf, type JournalGroup } from "~/lib/server-stats";
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

// An alliance's arrivals and departures already show as its players' Changes: the server's feeds leave them out.
const NOT_MEMBERSHIP: Prisma.JournalEntryWhereInput = {
  NOT: [{ change: { path: ["kind"], equals: "joined" } }, { change: { path: ["kind"], equals: "left" } }],
};

/** The date of the export the pages show, null before the first pass of the cron. */
export async function lastReading(server: string): Promise<Date | null> {
  const read = await db.exportRead.findUnique({ where: { server_kind: { server, kind: "players" } } });
  return read ? versionDate(read.version) : null;
}

/** A server at a glance, for the home page; null before the cron's first pass on it. */
export async function serverBulletin(server: string) {
  const reading = await lastReading(server);
  if (!reading) return null;
  const since = new Date(reading.getTime() - 14 * 24 * 3600 * 1000);
  const [players, alliances, colonized, perDay, journal] = await Promise.all([
    db.player.count({ where: { server } }),
    db.alliance.count({ where: { server } }),
    db.player.count({ where: { server, masterId: { not: null } } }),
    db.playerDay.groupBy({
      by: ["day"],
      where: { server, day: { gte: since } },
      _count: { _all: true },
      orderBy: { day: "asc" },
    }),
    // The latest of the diplomacy: what a visitor of the home page cares for first.
    db.journalEntry.findMany({
      where: {
        server,
        OR: ["war", "pact", "war-ended", "pact-ended"].map((kind) => ({ change: { path: ["kind"], equals: kind } })),
      },
      orderBy: { at: "desc" },
      take: 2,
    }),
  ]);
  return {
    reading,
    players,
    alliances,
    colonized,
    playersPerDay: perDay.map((row) => ({ day: row.day, players: row._count._all })),
    journal: journal.map(toLine),
  };
}

export type ServerBulletin = NonNullable<Awaited<ReturnType<typeof serverBulletin>>>;

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
    db.journalEntry.findMany({
      where: { server, ...NOT_MEMBERSHIP },
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

/** The Journal's last 30 Paris days, oldest first; a day without a Change is missing. Alliances' arrivals and
 * departures left out, as in the feeds. */
export async function journalPerDay(server: string): Promise<JournalDay[]> {
  const rows = await db.$queryRaw<{ day: Date; kind: string | null; count: bigint }[]>`
    SELECT ((at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date AS day, change->>'kind' AS kind, count(*) AS count
    FROM "JournalEntry"
    WHERE server = ${server} AND at > now() - interval '30 days' AND change->>'kind' NOT IN ('joined', 'left')
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

/** A page of the server's Journal, latest first: of one group of Changes, about a name, on a Paris day. */
export async function journalPage(
  server: string,
  { group, q, day, page }: { group: JournalGroup | null; q: string; day: { gte: Date; lt: Date } | null; page: number },
) {
  const where: Prisma.JournalEntryWhereInput = {
    server,
    AND: [
      NOT_MEMBERSHIP,
      ...(group ? [{ OR: kindsOf(group).map((kind) => ({ change: { path: ["kind"], equals: kind } })) }] : []),
      ...(q ? [{ name: { contains: q, mode: "insensitive" as const } }] : []),
      ...(day ? [{ at: day }] : []),
    ],
  };
  const [total, lines] = await Promise.all([
    db.journalEntry.count({ where }),
    db.journalEntry.findMany({
      where,
      orderBy: [{ at: "desc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, lines: lines.map(toLine) };
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

/** The alliance's members as the latest export shows them, for the chain's roles of a space (site-chaine.md). */
export function allianceRoster(server: string, tag: string) {
  return db.player.findMany({
    where: { server, alliance: { equals: tag, mode: "insensitive" } },
    select: { id: true, pseudo: true, field: true, onHoliday: true, isBanned: true },
    orderBy: { field: "desc" },
  });
}

/** `field` is the alliance's TDC now, for its rank among the server's alliances. */
export async function alliancePage(server: string, tag: string, field: number) {
  const [members, days, journal, ranks, above, serverField] = await Promise.all([
    db.player.findMany({ where: { server, alliance: tag }, orderBy: { field: "desc" } }),
    db.allianceDay.findMany({ where: { server, tag }, orderBy: { day: "asc" } }),
    db.journalEntry.findMany({ where: { server, tag }, orderBy: { at: "desc" }, take: 100 }),
    db.$queryRaw<{ day: Date; rank: bigint }[]>`
      SELECT d.day, (SELECT count(*) FROM "AllianceDay" o WHERE o.server = d.server AND o.day = d.day AND o."totalField" > d."totalField") + 1 AS rank
      FROM "AllianceDay" d
      WHERE d.server = ${server} AND d.tag = ${tag}
      ORDER BY d.day`,
    db.alliance.count({ where: { server, totalField: { gt: field } } }),
    db.player.aggregate({ where: { server }, _sum: { field: true } }),
  ]);
  // A week before the last reading: each member's TDC then, for « 7 jours ».
  const weekBefore = days.at(-8)?.day;
  const masterIds = [...new Set(members.flatMap((member) => (member.masterId === null ? [] : [member.masterId])))];
  const [before, masters] = await Promise.all([
    weekBefore
      ? db.playerDay.findMany({
          where: { server, day: weekBefore, playerId: { in: members.map((member) => member.id) } },
          select: { playerId: true, field: true },
        })
      : [],
    db.player.findMany({ where: { server, id: { in: masterIds } }, select: { id: true, pseudo: true } }),
  ]);
  return {
    members,
    /** Each member's TDC a week before the last reading, by id; missing for a newcomer. */
    weekAgo: new Map(before.map((row) => [row.playerId, row.field])),
    /** The pseudo of each master of a member, by id. */
    masters: new Map(masters.map((row) => [row.id, row.pseudo])),
    days,
    journal: journal.map(toLine),
    /** By TDC among the server's alliances, 1 first. */
    rank: above + 1,
    /** The TDC of the whole server, for the alliance's share. */
    serverField: serverField._sum.field ?? 0,
    ranks: ranks.map((row) => ({ day: row.day, rank: Number(row.rank) })),
  };
}

/** One player or alliance on the Comparer page: its curve of `metric`, and the figure of now. */
export interface Compared {
  id: string;
  name: string;
  /** A player's alliance. */
  alliance: string | null;
  now: number;
  /** By TDC on the server now, 1 first, whatever the curve shown. */
  rankNow: number;
  points: { day: Date; value: number }[];
}

const PLAYER_SCORE: Record<
  Exclude<CompareMetric, "rank">,
  (row: { field: number; buildingScore: number; technologyScore: number; trophyScore: number }) => number
> = {
  field: (row) => row.field,
  building: (row) => row.buildingScore,
  technology: (row) => row.technologyScore,
  trophy: (row) => row.trophyScore,
};

const ALLIANCE_SCORE: Record<
  Exclude<CompareMetric, "rank">,
  (row: {
    totalField: number;
    totalBuildingScore: number;
    totalTechnologyScore: number;
    totalTrophyScore: number;
  }) => number
> = {
  field: (row) => row.totalField,
  building: (row) => row.totalBuildingScore,
  technology: (row) => row.totalTechnologyScore,
  trophy: (row) => row.totalTrophyScore,
};

/** The players (ids) or alliances (tags) still in the export, in the order of `ids`, from `since` on. */
export async function compared(
  server: string,
  kind: CompareKind,
  ids: string[],
  metric: CompareMetric,
  since: Date | null,
): Promise<Compared[]> {
  if (ids.length === 0) return [];
  const after = since ? { gte: since } : undefined;
  if (kind === "players") {
    const playerIds = ids.map(Number);
    const [players, days, ranks] = await Promise.all([
      db.player.findMany({ where: { server, id: { in: playerIds } } }),
      metric === "rank"
        ? []
        : db.playerDay.findMany({
            where: { server, playerId: { in: playerIds }, day: after },
            orderBy: { day: "asc" },
          }),
      metric === "rank"
        ? db.$queryRaw<{ id: number; day: Date; rank: bigint }[]>`
            SELECT d."playerId" AS id, d.day, (SELECT count(*) FROM "PlayerDay" o WHERE o.server = d.server AND o.day = d.day AND o.field > d.field) + 1 AS rank
            FROM "PlayerDay" d
            WHERE d.server = ${server} AND d."playerId" = ANY(${playerIds}) AND d.day >= ${since ?? new Date(0)}
            ORDER BY d.day`
        : [],
    ]);
    return Promise.all(
      playerIds.flatMap((id) => {
        const player = players.find((row) => row.id === id);
        if (!player) return [];
        return [
          (async (): Promise<Compared> => {
            const rankNow = (await db.player.count({ where: { server, field: { gt: player.field } } })) + 1;
            return {
              id: String(id),
              name: player.pseudo,
              alliance: player.alliance,
              rankNow,
              now: metric === "rank" ? rankNow : Math.round(PLAYER_SCORE[metric](player)),
              points:
                metric === "rank"
                  ? ranks.filter((row) => row.id === id).map((row) => ({ day: row.day, value: Number(row.rank) }))
                  : days
                      .filter((row) => row.playerId === id)
                      .map((row) => ({ day: row.day, value: Math.round(PLAYER_SCORE[metric](row)) })),
            };
          })(),
        ];
      }),
    );
  }
  const [alliances, days, ranks] = await Promise.all([
    db.alliance.findMany({ where: { server, tag: { in: ids } } }),
    metric === "rank"
      ? []
      : db.allianceDay.findMany({ where: { server, tag: { in: ids }, day: after }, orderBy: { day: "asc" } }),
    metric === "rank"
      ? db.$queryRaw<{ tag: string; day: Date; rank: bigint }[]>`
          SELECT d.tag, d.day, (SELECT count(*) FROM "AllianceDay" o WHERE o.server = d.server AND o.day = d.day AND o."totalField" > d."totalField") + 1 AS rank
          FROM "AllianceDay" d
          WHERE d.server = ${server} AND d.tag = ANY(${ids}) AND d.day >= ${since ?? new Date(0)}
          ORDER BY d.day`
      : [],
  ]);
  return Promise.all(
    ids.flatMap((tag) => {
      const alliance = alliances.find((row) => row.tag === tag);
      if (!alliance) return [];
      return [
        (async (): Promise<Compared> => {
          const rankNow = (await db.alliance.count({ where: { server, totalField: { gt: alliance.totalField } } })) + 1;
          return {
            id: tag,
            name: alliance.tag,
            alliance: null,
            rankNow,
            now: metric === "rank" ? rankNow : Math.round(ALLIANCE_SCORE[metric](alliance)),
            points:
              metric === "rank"
                ? ranks.filter((row) => row.tag === tag).map((row) => ({ day: row.day, value: Number(row.rank) }))
                : days
                    .filter((row) => row.tag === tag)
                    .map((row) => ({ day: row.day, value: Math.round(ALLIANCE_SCORE[metric](row)) })),
          };
        })(),
      ];
    }),
  );
}

/** The player of that pseudo, any case: what the Comparer adds from a typed name. */
export function findPlayerByPseudo(server: string, pseudo: string) {
  return db.player.findFirst({ where: { server, pseudo: { equals: pseudo, mode: "insensitive" } } });
}

/** The day of the latest nightly reading of the server, for the Comparer's periods. */
export async function lastDay(server: string): Promise<Date | null> {
  const last = await db.playerDay.findFirst({ where: { server }, orderBy: { day: "desc" }, select: { day: true } });
  return last?.day ?? null;
}
