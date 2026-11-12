# Plan 010: A Joueur cannot store more Envoi rows than a real extension ever sends

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- apps/web/src/server/envois/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The site (`apps/web`) keeps "Envois": encrypted rows that a member's browser extension sends for their Joueur
(convoys, floods, hunts, and four "states"). The site cannot read them; it only bounds them. Today the only
bound is per request (2 000 items, each up to two blobs of 8 000 characters). Nothing bounds how many rows a
Joueur has **in total**: every request with fingerprints never seen before adds rows, kept 40 to 120 days. Any
free account with one Joueur in a one-member space can therefore fill the disk of the single small VPS that
hosts the database. After this plan, each Joueur has a ceiling per category, far above what a real extension
sends, and a request that would pass it is refused whole.

## Current state

- `apps/web/src/server/envois/envoi-service.ts` — the rules. Relevant parts:

  ```ts
  // :22
  const MAX_ITEMS = 2000;

  // :24-33
  interface CategoryRules {
    /** The settings that let it go: any of them; none for an explicit act on the space page. */
    settings: readonly string[];
    /** How long a row may stay at most, whatever an extension says. */
    longest: number;
    /** The setting that lets an item carry a blob for the Admins only; null when it never does. */
    detail: string | null;
    /** A state is one row per Joueur (docs/features/site-envois.md, « Ce que garde le site »). */
    maxItems: number;
  }

  // :39-58, twelve entries of this shape
  const CATEGORIES = {
    convoys: { settings: ["convoys"], longest: 100 * DAY, detail: null, maxItems: MAX_ITEMS },
    …
    production: { settings: ["production"], longest: 100 * DAY, detail: null, maxItems: 1 },
    …
  } satisfies Record<string, CategoryRules>;

  // :183, in saveEnvoi
  if (!Array.isArray(body.items) || body.items.length > rules.maxItems) throw invalid();

  // :66
  const invalid = () => new EnvoiError("invalid", "Envoi refusé : il n'a pas la forme attendue.");

  // :225-227, end of saveEnvoi
  const added = await store.writeItems(space.id, player, category, items, removed, at);
  // New flood rows: « Nouveaux floods sur l'espace … », content-free (docs/features/site-discord.md).
  if (category === "floods" && added > 0) remind(space.id, "floods");
  ```

  `EnvoiError` codes are `"invalid" | "forbidden" | "not-found" | "stale-key" | "category-off"`; `invalid` is
  answered as HTTP 400 by `extension-routes.ts:14`. Do not add a code.

- `apps/web/src/server/envois/store.ts:59-71` — the store's contract:

  ```ts
  /**
   * Writes the Joueur's items of a category in a space: a new fingerprint is added, a known one replaced only when its
   * blob or its detail changed (its `updatedAt` then moves to `now`, which the relève follows), and the fingerprints `removed` go.
   * Rows past their `expiresAt` in the space go too. Returns how many fingerprints were new.
   */
  writeItems(
    spaceId: string,
    player: PlayerRef,
    category: string,
    items: ItemInput[],
    removed: string[],
    now: Date,
  ): Promise<number>;
  ```

- `apps/web/src/server/envois/prisma-store.ts:66-104` — the Postgres store. Inside one `db.$transaction`: deletes
  the space's expired rows, deletes `removed`, reads the `known` fingerprints, computes
  `const added = items.filter((i) => !known.has(i.fingerprint));`, inserts `added` with `createMany`, updates the
  changed ones, returns `created.count`. `mine` is `{ spaceId, server, playerId, category }`.
- `apps/web/src/server/envois/memory-store.ts:54-86` — the same contract in memory, used by the service tests:
  filters `rows`, then for each item either updates the known row or pushes a new one and counts it in `added`.
- `store.writeItems` has one caller: `envoi-service.ts:225`.
- Tests: `envoi-service.test.ts` (memory store; helpers `fp(n)`, `item(n)`, `send(who, items, removed)` at lines
  23-50; the states are in `describe("the states", …)` at line 382) and `prisma-store.db.test.ts` (real
  database, skipped without `TEST_DATABASE_URL`).
- Conventions: English code and comments; messages shown to the player in French, addressing them as « vous ».

## Commands you will need

| Purpose     | Command                                      | Expected on success |
| ----------- | -------------------------------------------- | ------------------- |
| Typecheck   | `pnpm typecheck`                             | exit 0              |
| Lint        | `pnpm lint`                                  | exit 0              |
| Envoi tests | `pnpm vitest run apps/web/src/server/envois` | all pass            |
| All tests   | `pnpm vitest run`                            | all pass            |

Run from the repository root. The database tests need `TEST_DATABASE_URL` (see `apps/web/.env.example` line 2
for the local URL, after `cd apps/web && docker compose up -d && pnpm exec prisma migrate deploy`).

## Scope

**In scope**:

- `apps/web/src/server/envois/envoi-service.ts`
- `apps/web/src/server/envois/store.ts`
- `apps/web/src/server/envois/prisma-store.ts`
- `apps/web/src/server/envois/memory-store.ts`
- `apps/web/src/server/envois/envoi-service.test.ts`
- `apps/web/src/server/envois/prisma-store.db.test.ts`

**Out of scope**:

- The extension (`apps/extension`): it must keep working unchanged.
- `apps/web/src/server/envois/extension-routes.ts` and the error codes.
- The Prisma schema: no migration.
- The Demandes (`apps/web/src/server/demandes/`), which have their own limit.

## Git workflow

- Branch: `fix/cap-envoi-rows`.
- One commit, e.g. `fix(web): a ceiling on the Envoi rows kept per Joueur and category`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: Tests first, on the memory store

In `envoi-service.test.ts`:

1. In the top-level describe, add "refuses an Envoi that would pass the ceiling of rows kept, and keeps what was
   there". Build one blob once (`const blob = (await item(0)).blob`) and reuse it for every item, so the test
   stays fast: `const batch = (from: number) => Array.from({ length: 2000 }, (_, i) => ({ fingerprint: fp(from + i), blob, expiresAt: now.getTime() + 90 * DAY }))`.
   Check « Convois » for `messor` the way the neighbouring tests do, send `batch(0)`, `batch(2000)`,
   `batch(4000)` (all accepted, 6 000 rows), then expect `send(messor, [await item(6000)])` to fail with code
   `invalid` (use the file's `failure` helper), and `readEnvois` to still list 6 000 items. Then send
   `[]` with `removed: [fp(0)]` followed by `[await item(6000)]`: accepted.
2. In `describe("the states", …)`, add "never keeps more than a few rows of a state": send the `production`
   state five times, each with a different fingerprint and no `removed`, the way the existing tests of that
   describe send a state; the fifth fails with code `invalid`.

**Verify**: `pnpm vitest run apps/web/src/server/envois/envoi-service.test.ts` → the 2 new tests fail, the others pass.

### Step 2: The ceiling in the rules and the store contract

1. `envoi-service.ts`: add to `CategoryRules`

   ```ts
   /** Rows kept for a Joueur at most: several requests with new fingerprints never pile up past it. */
   maxStored: number;
   ```

   and to each entry of `CATEGORIES`: `maxStored: 3 * MAX_ITEMS` where `maxItems` is `MAX_ITEMS`, and
   `maxStored: 4` where `maxItems` is `1` (the reading and the one before it, with room for a change of key).

2. `store.ts`: `writeItems` takes a last parameter `limit: number` and returns `Promise<number | "full">`.
   Extend its comment: "Nothing is added, and `"full"` comes back, when the Joueur would then have more than
   `limit` rows of this category in the space."
3. `envoi-service.ts`, end of `saveEnvoi`:

   ```ts
   const added = await store.writeItems(space.id, player, category, items, removed, at, rules.maxStored);
   if (added === "full")
     throw new EnvoiError("invalid", "Envoi refusé : trop de lignes sont déjà gardées pour cette catégorie.");
   ```

4. `memory-store.ts`: after the first `rows = rows.filter(…)`, count the Joueur's rows of the category in the
   space and the items whose fingerprint is not among them; if the sum is above `limit`, return `"full"` before
   changing anything else.
5. `prisma-store.ts`: right after `const added = …`, inside the transaction:

   ```ts
   if (added.length > 0 && (await tx.envoiItem.count({ where: mine })) + added.length > limit) return "full";
   ```

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.
`pnpm vitest run apps/web/src/server/envois` → all pass, including the 2 new tests.

### Step 3: The same on Postgres

In `prisma-store.db.test.ts`, add one test modelled on the first test of the file (line 61): for Joueur `a`,
with « Convois » checked, send three batches of 2 000 new fingerprints sharing one blob, then one more item:
it fails with an `EnvoiError` whose `code` is `invalid`, and `readEnvois(a.userId, { spaceId })` has not grown.
Use fingerprints the other tests of the file do not use (the file's `fp(n)` with `n` from 1000 up).

**Verify**: with `TEST_DATABASE_URL` set, `pnpm vitest run apps/web/src/server/envois/prisma-store.db.test.ts`
→ all pass, none skipped. Without Docker, say in your report that this test only ran in CI.

### Step 4: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run` → exit 0.

## Test plan

Three tests: two on the memory store (step 1), one on Postgres (step 3). The first is the regression test for
the unbounded growth; the second guards the states.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `grep -n "maxStored" apps/web/src/server/envois/envoi-service.ts` → 14 lines (the interface, 12 categories, the call)
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- An existing test of `apps/web/src/server/envois` or `apps/extension/src/features/optizzz-account` fails
  because of the ceiling: a real flow needs more rows than assumed. Report the test name; do not raise the
  ceiling yourself.
- `writeItems` has another caller than `envoi-service.ts`.

## Maintenance notes

- The ceilings are a judgment: 6 000 rows of a list category is 60 a day over the 100 days a row lives, and a
  state is one row. If a member reports « trop de lignes », look at how many live rows they have before raising it.
- A refused request still removes expired rows and the fingerprints in `removed`: that is wanted, it is how the
  Joueur gets room back.
- The extension shows the message of an `invalid` answer in « Compte Optizzz » and tries again at the next game
  page. It is not told apart from a malformed Envoi; a dedicated code would need an extension release.
