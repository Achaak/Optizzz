# Plan 009: A nightly export is stored whole or not at all

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- apps/web/src/ingest/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The site (`apps/web`) has an hourly cron that stores, for each game server and each Paris day, one `PlayerDay`
row per player (216 000 rows a day for server S4). These rows feed every curve and every rank history. Today a
day's rows are inserted in chunks of 5 000 with no transaction, and a day counts as "already stored" as soon as
it has **one** row. If the pass dies between two chunks (out of memory, systemd timeout, database restart
during a deployment), the day keeps a part of its rows and is never retried: its totals and ranks are wrong for
good. After this plan, a day's rows are written in one transaction: an interrupted day leaves no row and is
taken again at the next pass.

## Current state

- `apps/web/src/ingest/ingest.ts` — one pass of the cron over a server. Relevant parts:

  ```ts
  // ingest.ts:24-25
  /** Rows per insert. */
  const CHUNK = 5000;

  // ingest.ts:69-71
  async function inChunks<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<unknown>) {
    for (let start = 0; start < rows.length; start += CHUNK) await insert(rows.slice(start, start + CHUNK));
  }

  // ingest.ts:245-265, inside `ingestServer(db: PrismaClient, server: GameServer, now: Date)`
  // A GROUP BY in SQL: Prisma's `distinct` would download every row and drop the doubles in memory.
  const storedPlayerDays = await db.playerDay.groupBy({ by: ["day"], where: { server: server.id } });
  for (const { day, version } of missingDays(
    versions.players,
    new Set(storedPlayerDays.map((row) => columnDay(row.day))),
    now,
    DAYS_PER_PASS,
  )) {
    const rows = (await players(version, false)).map((player) => ({
      server: server.id,
      playerId: player.id,
      day: dayColumn(day),
      alliance: player.alliance,
      field: player.field,
      buildingScore: player.buildingScore,
      technologyScore: player.technologyScore,
      trophyScore: player.trophyScore,
    }));
    await inChunks(rows, (chunk) => db.playerDay.createMany({ data: chunk, skipDuplicates: true }));
    report.days++;
  }
  ```

  The same file already uses an interactive transaction with a long timeout for the current state
  (`ingest.ts:180-227`): `await db.$transaction(async (tx) => { … }, { timeout: 600_000, maxWait: 30_000 });`.
  Match that shape.

- `apps/web/src/ingest/days.ts:15-25` — `missingDays` keeps the days absent from the `stored` set. Do not change it.
- `AllianceDay` rows are written with a single `createMany` (`ingest.ts:284`): already atomic, leave it.
- `apps/web/prisma/schema.prisma:71-84` — `PlayerDay`: primary key `(server, playerId, day)`, `server` is a free
  string with no foreign key, `buildingScore` is a 32-bit `Int`.
- Tests against a real database: files named `*.db.test.ts`, skipped without `TEST_DATABASE_URL`. Exemplar:
  `apps/web/src/server/envois/prisma-store.db.test.ts:1-16`:

  ```ts
  // Against a real database (TEST_DATABASE_URL, migrations applied): the local Docker one, or CI's. Skipped without it.
  import { PrismaPg } from "@prisma/adapter-pg";
  import { randomUUID } from "node:crypto";
  import { afterAll, describe, expect, it } from "vitest";
  import { PrismaClient } from "~/generated/prisma/client";

  const url = process.env.TEST_DATABASE_URL;

  describe.skipIf(!url)("…", () => {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "" }) });
  ```

- Conventions: code, comments and test names in English; comments say why, in one or two lines, like the ones
  above. No `any`. Prettier at 120 columns.

## Commands you will need

| Purpose             | Command                                                                                         | Expected on success    |
| ------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| Typecheck           | `pnpm typecheck`                                                                                | exit 0                 |
| Lint                | `pnpm lint`                                                                                     | exit 0                 |
| Ingest tests        | `pnpm vitest run apps/web/src/ingest`                                                           | all pass               |
| Local database      | `cd apps/web && docker compose up -d && pnpm exec prisma migrate deploy && cd ../..`            | exit 0                 |
| Tests with database | `TEST_DATABASE_URL=<DATABASE_URL of apps/web/.env.example> pnpm vitest run apps/web/src/ingest` | all pass, none skipped |
| All tests           | `pnpm vitest run`                                                                               | all pass               |

Run everything from the repository root. `apps/web/.env.example` line 2 holds the local database URL (port 5433).

## Scope

**In scope**:

- `apps/web/src/ingest/ingest.ts`
- `apps/web/src/ingest/ingest.db.test.ts` (create)

**Out of scope**:

- `apps/web/src/ingest/days.ts` and the rule "a day with a row is stored": with an atomic write it becomes correct.
- The current-state transaction (`ingest.ts:180-227`), the map file, `AllianceDay`.
- `apps/web/scripts/ingest.ts`, `deploy/`.
- Repairing days already incomplete in production (see Maintenance notes).

## Git workflow

- Branch: `fix/ingest-atomic-player-day`.
- One commit, Conventional Commits, e.g. `fix(web): a nightly export is stored whole or not at all`.
- The pre-commit hook runs lint-staged, typecheck and the tests: never `--no-verify`. Do not push.

## Steps

### Step 1: Write the failing database test

Create `apps/web/src/ingest/ingest.db.test.ts`, modelled on the exemplar above. It imports
`storePlayerDays` from `./ingest` (added in step 2) and uses a server id unique to the run,
`const server = \`t${randomUUID().slice(0, 6)}\``. Build rows with a helper:

```ts
const row = (playerId: number, buildingScore = 1) => ({
  server,
  playerId,
  day: new Date("2026-11-01T00:00:00Z"),
  alliance: null,
  field: 10,
  buildingScore,
  technologyScore: 1,
  trophyScore: 1,
});
```

Two tests:

1. "stores every row of a day": `await storePlayerDays(db, [row(1), row(2), row(3)], 2)`, then
   `db.playerDay.count({ where: { server } })` is `3`.
2. "leaves no row of a day whose write fails half-way": delete the server's rows first, then
   `await expect(storePlayerDays(db, [row(1), row(2), row(3, 2 ** 40)], 2)).rejects.toThrow()` (the third row,
   in the second chunk, does not fit a 32-bit integer), then the count is `0`.

`afterAll`: `await db.playerDay.deleteMany({ where: { server } }); await db.$disconnect();`.

**Verify**: `pnpm typecheck` → fails only because `storePlayerDays` does not exist yet.

### Step 2: Write a day in one transaction

In `apps/web/src/ingest/ingest.ts`:

1. Give `inChunks` an optional size: `async function inChunks<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<unknown>, size = CHUNK)`
   and use `size` in the loop.
2. Add, after `inChunks`:

   ```ts
   /**
    * A day's rows, all or none: a day counts as stored as soon as it has a row (days.ts), so a pass cut between two
    * chunks must leave nothing, and the day is taken again at the next pass.
    */
   export const storePlayerDays = (db: PrismaClient, rows: Prisma.PlayerDayCreateManyInput[], size = CHUNK) =>
     db.$transaction(
       (tx) => inChunks(rows, (chunk) => tx.playerDay.createMany({ data: chunk, skipDuplicates: true }), size),
       { timeout: 600_000, maxWait: 30_000 },
     );
   ```

   `Prisma` and `PrismaClient` are already imported as types at `ingest.ts:17`.

3. In `ingestServer`, replace the line
   `await inChunks(rows, (chunk) => db.playerDay.createMany({ data: chunk, skipDuplicates: true }));`
   with `await storePlayerDays(db, rows);`.

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.
`grep -n "db.playerDay.createMany" apps/web/src/ingest/ingest.ts` → no match.

### Step 3: Run the tests against a database

Start the local database and apply the migrations (see the commands table), then run the ingest tests with
`TEST_DATABASE_URL` set.

**Verify**: both new tests pass and are not reported as skipped. Then `pnpm vitest run` → all pass.

If Docker is not available on your machine, say so in your report: the two tests are then only run by CI, and
you must not report them as verified.

## Test plan

The two tests of step 1, in `apps/web/src/ingest/ingest.db.test.ts`. The second one is the regression test: it
fails on the old code path (a first chunk committed before the failure) and passes with the transaction.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] With `TEST_DATABASE_URL` set, `pnpm vitest run apps/web/src/ingest/ingest.db.test.ts` → 2 passed, 0 skipped
- [ ] `grep -n "db.playerDay.createMany" apps/web/src/ingest/ingest.ts` returns nothing
- [ ] Only the two in-scope files are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `ingest.ts` no longer contains the loop shown in "Current state".
- The second test passes without the transaction (the failing row was rejected before any chunk was written):
  the test proves nothing, report it instead of weakening it.
- `pnpm knip` reports `storePlayerDays` as an unused export even though the test imports it.

## Maintenance notes

- Days already incomplete in production are not repaired by this plan. To find them, compare
  `SELECT server, day, count(*) FROM "PlayerDay" GROUP BY 1, 2 ORDER BY 1, 2` with the neighbouring days: a day
  far below its neighbours was cut. Deleting its rows makes the next pass take it again, as long as the game
  still publishes that export.
- The transaction holds S4's 216 000 inserts for a few seconds; readers see the day appear at once.
- Plan 018 adds tests for the whole of `ingestServer`, in its own file; run it after this plan.
