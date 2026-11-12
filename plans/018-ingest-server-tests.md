# Plan 018: The cron's pass over a server is tested end to end against a database

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- apps/web/src/ingest/`
> Plan 009 changes `ingest.ts` before this one (a day's rows written in a transaction, `storePlayerDays`): that
> is expected. This plan adds a test file only; compare the behaviour described below against the live code.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (run after plans/009-ingest-atomic-player-day.md, which edits the code under test)
- **Category**: tests
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

`ingestServer` in `apps/web/src/ingest/ingest.ts` is the only code that writes the public data of the site:
every player page, alliance page, curve, map and Journal entry comes from it, for every game server, every
hour. Its helpers are tested (`days.test.ts`, `diff.test.ts`, `player-writes.test.ts`); the function itself is
not: no test imports it. It was changed eight times in three weeks, most recently to write only the players
that changed — exactly the kind of optimisation that drifts silently. A mistake there corrupts every public
page. This plan adds tests that run two or three passes on a tiny made-up server against a real database and
check what is stored. It changes no production code.

## Current state

- `apps/web/src/ingest/ingest.ts` — `export async function ingestServer(db: PrismaClient, server: GameServer, now: Date): Promise<PassReport>`
  with `PassReport = { updated: boolean; changes: number; days: number }`. What a pass does, in order:
  1. Downloads the list of versions from `exportUrl(server.origin)` with the global `fetch`
     (`getJsonOnce`, lines 41-48: `fetch(url, { headers, signal })`, then `response.ok` and `response.json()`).
     A failed download is retried after 10 seconds, three times: **a test must never make a download fail**.
  2. Reads what it last stored in `ExportRead` (one row per `kind`: `players`, `alliances`).
  3. If the latest version differs: downloads the latest players and alliances; gets the previous reading from
     the API when that version is still listed, **otherwise from the database** (`Player` and `Alliance` rows);
     computes the changes (`diffReadings`); then in one transaction writes the players that changed, deletes
     the ones gone, replaces the alliances, adds one `JournalEntry` per change (none on the very first pass),
     and updates `ExportRead`. Sets `report.updated = true` and `report.changes = <number of changes>`.
  4. Writes the server's `MapFile` (column `version`) when its version is not the latest players version.
  5. For each Paris day whose first export is listed and which has no `PlayerDay` row yet (ten days at most):
     stores one `PlayerDay` row per player and counts it in `report.days`. Same for `AllianceDay` (not counted).
- `packages/game/src/servers.ts` — `interface GameServer { id: string; name: string; origin: string }`.
- `packages/game/src/exports.ts`:

  ```ts
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
  export const allianceSchema = z.object({
    tag: z.string(),
    name: z.string(),
    playersCount: z.number().int(),
    totalField: z.number(),
    totalBuildingScore: z.number(),
    totalTechnologyScore: z.number(),
    totalTrophyScore: z.number(),
    diplomacy: z.object({
      pacts: z.array(z.object({ tag: z.string(), name: z.string(), description: z.string() })),
      wars: z.array(z.string()),
    }),
  });
  /** `GET /api/exports/`: the published versions, latest first. */
  export const versionsSchema = z.object({ players: z.array(z.string()), alliances: z.array(z.string()) });
  export function exportUrl(origin: string, kind?: ExportKind, version?: string): string {
    if (!kind) return `${origin}/api/exports/`;
    return `${origin}/api/exports/${kind}/${version ? `?version=${version}` : ""}`;
  }
  ```

- A version is a UTC date written `YYYYMMDDHHmm` (`packages/game/src/export-versions.ts`); the first version
  of a Paris day is that day's nightly export. `202611010005` is 1 November 2026, 00:05 UTC, 01:05 in Paris.
- Database: the columns `server` of `Player`, `Alliance`, `PlayerDay`, `AllianceDay`, `JournalEntry`,
  `ExportRead` and `MapFile` are free strings with no foreign key (`apps/web/prisma/schema.prisma:15-134`), so
  a made-up server id is safe and easy to clean up.
- The pattern for database tests, `apps/web/src/server/envois/prisma-store.db.test.ts:1-16`:

  ```ts
  // Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
  import { PrismaPg } from "@prisma/adapter-pg";
  import { randomUUID } from "node:crypto";
  import { afterAll, beforeAll, describe, expect, it } from "vitest";
  import { PrismaClient } from "~/generated/prisma/client";

  const url = process.env.TEST_DATABASE_URL;

  describe.skipIf(!url)("the Envois' store on Postgres", () => {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  ```

  CI sets `TEST_DATABASE_URL` and applies the migrations before the tests (`.github/workflows/ci.yml`).

- The site's vitest project runs in `node` with `TZ=Europe/Paris` (`apps/web/vitest.config.ts`).

## Commands you will need

| Purpose        | Command                                                                                         | Expected on success    |
| -------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| Local database | `cd apps/web && docker compose up -d && pnpm exec prisma migrate deploy && cd ../..`            | exit 0                 |
| These tests    | `TEST_DATABASE_URL=<DATABASE_URL of apps/web/.env.example> pnpm vitest run apps/web/src/ingest` | all pass, none skipped |
| Typecheck      | `pnpm typecheck`                                                                                | exit 0                 |
| Lint           | `pnpm lint`                                                                                     | exit 0                 |
| All tests      | `pnpm vitest run`                                                                               | all pass               |

This plan cannot be verified without a database: if Docker is not available, STOP (see below).

## Scope

**In scope**:

- `apps/web/src/ingest/ingest-server.db.test.ts` (create)

**Out of scope**:

- `apps/web/src/ingest/ingest.ts` and every other production file: if a test cannot be written without changing
  the code, that is a STOP condition, not a licence to refactor.
- `apps/web/scripts/ingest.ts` (the command-line wrapper: the run's record, the site's revalidation).

## Git workflow

- Branch: `test/ingest-server`.
- One commit, e.g. `test(web): the cron's pass over a server, against a database`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: The fake game server

Create `apps/web/src/ingest/ingest-server.db.test.ts` with the header and `describe.skipIf(!url)` of the
pattern above, and:

```ts
const server = { id: `t${randomUUID().slice(0, 6)}`, name: "Test", origin: "https://exports.test" };

const player = (id: number, alliance: string | null, field = 100 * id) => ({
  id,
  pseudo: `Player${String(id)}`,
  alliance,
  masterPlayerId: null,
  x: id,
  y: id,
  field,
  grade: null,
  buildingScore: 1,
  technologyScore: 1,
  trophyScore: 1,
  onHoliday: false,
  isBanned: false,
});
const alliance = (tag: string, playersCount: number) => ({
  tag,
  name: tag,
  playersCount,
  totalField: 1,
  totalBuildingScore: 1,
  totalTechnologyScore: 1,
  totalTrophyScore: 1,
  diplomacy: { pacts: [], wars: [] },
});

/** What the game publishes: the versions (latest first) and each version's players and alliances. */
let published: Record<string, { players: unknown[]; alliances: unknown[] }> = {};
```

Stub the global `fetch` in `beforeAll` with `vi.stubGlobal("fetch", …)` and restore it in `afterAll` with
`vi.unstubAllGlobals()`. The stub receives the URL as a string and answers with `Response.json(…)`:

- `${origin}/api/exports/` → `{ players: versions, alliances: versions }` where `versions` is
  `Object.keys(published).sort().reverse()`;
- `${origin}/api/exports/players/?version=V` → `published[V].players`; the same for `alliances`;
- anything else → **throw** an `Error` naming the URL (a test that asks an unexpected address must fail loudly,
  not wait 30 seconds in retries; a thrown error inside `fetch` is retried too, so also `expect` in each test
  that the list of requested URLs holds no unknown address — keep the URLs in an array).

`afterAll` also deletes this server's rows from `player`, `alliance`, `playerDay`, `allianceDay`,
`journalEntry`, `exportRead` and `mapFile` (`deleteMany({ where: { server: server.id } })`), then
`db.$disconnect()`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: The passes

Write the tests in one `describe`, in this order (they build on each other; say so in a comment):

1. **"stores the first export: players, alliances, the map and the night, without a Journal"**.
   `published = { "202611010005": { players: [player(1, "AAA"), player(2, "AAA"), player(3, null)], alliances: [alliance("AAA", 2)] } }`,
   `now = new Date("2026-11-01T02:00:00Z")`. Expect the report to equal `{ updated: true, changes: 0, days: 1 }`;
   3 `player` rows, 1 `alliance` row, 0 `journalEntry` rows, 3 `playerDay` rows and 1 `allianceDay` row for the
   server; both `exportRead` rows at version `202611010005`; `mapFile.version` equal to `202611010005`.
2. **"does nothing when no newer export is published"**: same `published`, run again. Report
   `{ updated: false, changes: 0, days: 0 }`; the counts are unchanged.
3. **"writes what changed since the last pass, and says it in the Journal"**: add version `202611010105` where
   player 2 has left its alliance (`player(2, null)`), player 3 is gone, player 4 is new, and the alliance has
   one member (`alliance("AAA", 1)`); `now = new Date("2026-11-01T03:00:00Z")`. Expect `report.updated` true,
   `report.days` 0, `report.changes` greater than 0 and equal to the server's `journalEntry` count; the
   `player` ids to be `[1, 2, 4]`; player 2's `alliance` to be null; `mapFile.version` and both `exportRead`
   rows at `202611010105`; still 3 `playerDay` rows (the day was already stored).
4. **"takes the previous reading from the database when the game no longer publishes it"**: replace
   `published` by a single new version `202611010205` (so the previous one is no longer listed) where player 1
   moved to alliance `"BBB"` and the alliances are `[alliance("AAA", 0), alliance("BBB", 1)]`;
   `now = new Date("2026-11-01T04:00:00Z")`. Expect `report.updated` true, the Journal to have grown, player
   1's `alliance` to be `"BBB"`, 2 `alliance` rows, and the list of requested URLs to hold no address with
   `version=202611010105`.
5. **"stores a new night once"**: add version `202611020005` with the same players as the latest;
   `now = new Date("2026-11-02T02:00:00Z")`. Expect `report.days` 1, and 6 `playerDay` rows in two distinct days.

**Verify**: with `TEST_DATABASE_URL` set, `pnpm vitest run apps/web/src/ingest/ingest-server.db.test.ts` →
5 passed, 0 skipped, in a few seconds (a run of 10 seconds or more means a download was retried: fix the stub).

### Step 3: Prove a test can fail

Temporarily change one expectation of test 3 to a wrong value (for example player ids `[1, 2, 3]`), run the
file, see it fail, and restore it. Do not commit the wrong value.

**Verify**: the run fails on that expectation, then passes again once restored.

### Step 4: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run` → exit 0. `git status --short` → one new file.

## Test plan

Five tests in one new file, as listed in step 2. They cover the first pass, an unchanged pass, a changed pass
with the previous reading from the API, the fallback to the database, and the nightly rows.

## Done criteria

- [ ] With `TEST_DATABASE_URL` set, `pnpm vitest run apps/web/src/ingest/ingest-server.db.test.ts` → 5 passed, 0 skipped
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `git status --short` shows only `apps/web/src/ingest/ingest-server.db.test.ts`
- [ ] After the run, `SELECT count(*) FROM "Player" WHERE server LIKE 't%' AND length(server) = 7` on the test
      database returns 0 (the cleanup worked), or the report says how it was checked
- [ ] `plans/README.md` status row updated

## STOP conditions

- No database is available (no Docker, no `TEST_DATABASE_URL`): these tests cannot be written blind.
- A test's expectation, as written above, does not hold and the code looks right (for example the first pass
  reports `days: 0`): report the actual values instead of bending the expectation — it may be a real bug, or
  this plan misread the code.
- A test cannot be written without exporting or changing something in `ingest.ts`.
- `vi.stubGlobal("fetch", …)` does not reach the `fetch` used by `ingest.ts`.

## Maintenance notes

- These tests are the safety net for the open performance work on the ingest and the pages (storing a rank per
  day, pre-aggregating a server's totals): run them first, change second.
- The exact number of Journal entries per change is `diffReadings`'s business, tested in `diff.test.ts`; here
  only "the report's count equals the rows written" is checked, on purpose.
- If the game's export gains a field, add it to `player()` or `alliance()` here, or zod rejects the fixture.
