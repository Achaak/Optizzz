# Plan 005: Attacks sent through the flood plan are never lost from storage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- src/data/launches.ts src/data/launches.test.ts src/data/on-way.ts src/data/on-way.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: plans/004-cross-tab-storage-lock.md (uses `withStorageLock` from `src/utils/storage-lock.ts`)
- **Category**: bug
- **Planned at**: commit `9361968`, 2026-10-16

## Why this matters

Optizzz (browser extension for Fourmizzz.fr) has a « Plan de flood » on the game's attack form. When the player
sends an attack through it, the attack ("launch": target, ants, expected take, arrival time) is remembered so
that later plans count what is already on its way. The game leaves the page as soon as the form is sent, so the
launch is first queued synchronously in the tab's `sessionStorage`, then moved to extension storage at the next
page load. Three defects lose launches:

1. `flushQueuedLaunches` removes the queue **before** awaiting the storage writes: if the page navigates during
   the write, the launch is gone — the exact case the queue exists for.
2. `loadLaunches` _writes_ (it prunes arrived launches) although read-only views call it (TDC chain, « Mon état »):
   it can overwrite a launch another tab just recorded.
3. `checkLaunches` loads the list, awaits a network fetch of `Armee.php`, then saves the reconciled list over
   whatever was stored meanwhile — dropping a launch recorded by another tab during the fetch.

A lost launch is then counted only as an "unknown" attack: it uses a slot, but its take is forgotten, so the
next plans over-estimate the target's field and under-estimate the player's. After this plan: the queue is
cleared only after it is stored, reads never write, and the reconcile-and-save keeps launches recorded during
the fetch. Writes go through `withStorageLock` (plan 004) so tabs of one server take turns.

## Current state

- `src/data/launches.ts` (per-server key `` `local:flood:${host}:launches` ``, entries stored with `arrivesAt` as ms):

  ```ts
  // lines 26-32
  /** The attacks still on their way; the ones arrived are forgotten. */
  export async function loadLaunches(origin: string, now: Date): Promise<Launch[]> {
    const stored = (await storage.getItem<StoredLaunch[]>(launchesKey(origin))) ?? [];
    const pending = stored.filter((launch) => launch.arrivesAt > now.getTime());
    if (pending.length !== stored.length) await storage.setItem(launchesKey(origin), pending);
    return pending.map(fromStored);
  }

  // lines 34-45
  export async function saveLaunches(origin: string, launches: Launch[]): Promise<void> { …setItem… }
  export async function recordLaunch(origin: string, launch: Launch): Promise<void> {
    const stored = (await storage.getItem<StoredLaunch[]>(launchesKey(origin))) ?? [];
    await storage.setItem(launchesKey(origin), [...stored, { ...launch, arrivesAt: launch.arrivesAt.getTime() }]);
  }

  // lines 70-75
  export async function flushQueuedLaunches(session: Storage, origin: string): Promise<void> {
    const queued = readQueue(session);
    if (queued.length === 0) return;
    session.removeItem(QUEUE_KEY);
    for (const launch of queued) await recordLaunch(origin, fromStored(launch));
  }
  ```

- `src/data/on-way.ts:18-30`:

  ```ts
  export async function checkLaunches(origin: string, now: Date, doc?: Document): Promise<OnWay> {
    const launches = await loadLaunches(origin, now);
    try {
      const page = doc ?? (await fetchGamePage("/Armee.php"));
      if (!page) throw new Error("Fourmizzz: error status on Armee.php");
      const checked = reconcileLaunches(launches, readAttacksOnWay(page, now));
      await saveLaunches(origin, checked.launches);
      return checked;
    } catch (error) {
      console.warn("[Optizzz] could not check the attacks on their way", error);
      return { launches, unknown: 0 };
    }
  }
  ```

  `reconcileLaunches(launches, onWay)` (`src/features/flood/attacks.ts:106-130`) pairs launches with the game's
  list by target name and closest arrival; **unpaired launches are dropped** and unpaired game attacks are
  counted in `unknown`. So a duplicate launch heals itself at the next check, but a lost one does not.

- Callers: `src/features/flood/index.ts:46` (`flushQueuedLaunches` on every page), `:50` and `:67`
  (`checkLaunches`), `src/features/targets/index.ts:28` (`checkLaunches`),
  `src/features/tdc-chain/TdcChain.tsx:117` and `src/features/alliance-sharing/MyState.tsx:62` (`loadLaunches`).

- `withStorageLock(name, task)` from `@/utils/storage-lock` (created by plan 004): runs `task` alone among tasks
  with the same `name`, across tabs of the origin.

- Tests: `src/data/launches.test.ts` (`fakeBrowser.reset()`, `sessionStorage.clear()`, helpers `at(hour, minute)`
  and `launch(target, arrivesAt)`); `src/data/on-way.test.ts` only tests `afterOnWay`. Armee.php fixtures with
  attacks on their way: `src/features/flood/__fixtures__/armee-attacks.html` and `armee-attacks-s5.html`
  (imported with `?raw`, parsed with `new DOMParser().parseFromString(html, "text/html")`, see
  `src/features/flood/attacks.test.ts:1-20`).

## Commands you will need

| Purpose   | Command                                                             | Expected on success |
| --------- | ------------------------------------------------------------------- | ------------------- |
| Typecheck | `pnpm typecheck`                                                    | exit 0              |
| Tests     | `pnpm vitest run src/data/launches.test.ts src/data/on-way.test.ts` | all pass            |
| All tests | `pnpm vitest run`                                                   | all pass            |
| Lint      | `pnpm lint`                                                         | 0 errors            |

## Scope

**In scope**: `src/data/launches.ts`, `src/data/launches.test.ts`, `src/data/on-way.ts`, `src/data/on-way.test.ts`.

**Out of scope**:

- `reconcileLaunches` in `src/features/flood/attacks.ts` (pairing rules).
- Validating the sessionStorage queue's shape — plan 007 does it (same file; do not pre-empt it).
- Defenses and lodge keys in `launches.ts`.

## Git workflow

- Branch: `fix/keep-flood-launches`. Commit e.g. `fix(flood): never lose an attack sent through the plan`.
- Pre-commit hook runs lint-staged, typecheck and tests: never `--no-verify`. Do not push.

## Steps

### Step 1: `loadLaunches` only reads

Remove the `setItem` line from `loadLaunches`; keep the filter. Update its comment:
`/** The attacks still on their way (the ones arrived are left out; they are dropped at the next write). */`

**Verify**: `pnpm vitest run src/data/launches.test.ts` → all pass (the existing test still sees only the
pending launch).

### Step 2: Lock and prune the writers

- `recordLaunch` becomes a thin wrapper of a new `recordLaunches(origin, launches: Launch[])` that, inside
  `withStorageLock(launchesKey(origin), …)`, reads the stored list, drops entries with `arrivesAt <= Date.now()`,
  appends the new ones, and writes once.
- `saveLaunches` writes inside the same lock.

**Verify**: `pnpm vitest run src/data/launches.test.ts` → all pass.

### Step 3: Flush the queue only once stored (test first)

Add to `describe("queued launches")`: "keeps the queue when storing fails" — make the storage write reject
(e.g. `vi.spyOn(fakeBrowser.storage.local, "set").mockRejectedValueOnce(new Error("quota"))`; if `wxt` storage
calls a different method, spy on that), call `flushQueuedLaunches`, expect it to reject or warn, and assert
`sessionStorage.getItem("optizzz-flood-queue")` is still non-null. Then change `flushQueuedLaunches` to:

```ts
const queued = readQueue(session);
if (queued.length === 0) return;
// Removed only once stored: a duplicate is dropped at the next check of Armee.php, a lost launch is not found again.
await recordLaunches(origin, queued.map(fromStored));
session.removeItem(QUEUE_KEY);
```

**Verify**: `pnpm vitest run src/data/launches.test.ts` → all pass, including the new test.

### Step 4: `checkLaunches` keeps launches recorded during the fetch (test first)

In `src/data/on-way.test.ts` add `describe("checkLaunches", …)` with `beforeEach(() => fakeBrowser.reset())`:

1. "drops a launch the game no longer lists": record a launch to a target absent from the fixture, call
   `checkLaunches(ORIGIN, now, doc)` with a parsed `armee-attacks.html`; the stored list no longer has it.
2. "keeps a launch recorded while the page was being read": use a `doc` argument of `undefined` and mock
   `fetchGamePage` (`vi.mock("@/utils/game-page", …)`) so that, **before resolving**, it calls
   `recordLaunch(ORIGIN, newLaunch)`; after `checkLaunches` resolves, `loadLaunches(ORIGIN, now)` contains `newLaunch`.

Pick `now` so that the fixture's attacks are in the future (read the dates in `attacks.test.ts`).

Then change `checkLaunches`:

```ts
const before = await loadLaunches(origin, now);
try {
  const page = doc ?? (await fetchGamePage("/Armee.php"));
  if (!page) throw new Error("Fourmizzz: error status on Armee.php");
  const onWay = readAttacksOnWay(page, now);
  return await withStorageLock(launchesKey(origin), async () => {
    // Launches recorded by another tab while the page was read are kept as they are: the page may predate them.
    const current = await loadLaunches(origin, now);
    const added = current.filter((launch) => !before.some((known) => sameLaunch(known, launch)));
    const checked = reconcileLaunches(before, onWay);
    const launches = [...checked.launches, ...added];
    await writeLaunches(origin, launches);
    return { launches, unknown: Math.max(0, checked.unknown - added.length) };
  });
} catch (error) { …unchanged… }
```

To make this possible without a deadlock (Web Locks are not re-entrant), export from `launches.ts`:

- `launchesKey` (or a `LAUNCHES_LOCK(origin)` helper), and
- `writeLaunches(origin, launches)` — the unlocked write; `saveLaunches` = lock + `writeLaunches`.
- `sameLaunch(a, b)`: same `targetId`, `take`, `ants` and `arrivesAt.getTime()`.

`checkLaunches` must call `writeLaunches`, **not** `saveLaunches`, inside its lock.

**Verify**: `pnpm vitest run src/data/on-way.test.ts src/data/launches.test.ts` → all pass.

### Step 5: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm knip` → all exit 0 (knip: no new unused
export; if `recordLaunch` becomes unused outside tests, keep it only if a non-test caller exists, otherwise
switch callers to `recordLaunches`).

## Test plan

- `launches.test.ts`: existing tests pass; new "keeps the queue when storing fails".
- `on-way.test.ts`: new `checkLaunches` tests (drop unlisted; keep recorded-during-fetch).

## Done criteria

- [ ] `grep -n "setItem" src/data/launches.ts` shows no write inside `loadLaunches`
- [ ] In `flushQueuedLaunches`, `removeItem` comes after the awaited store
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`, `pnpm knip` exit 0
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `src/utils/storage-lock.ts` does not exist (plan 004 not landed).
- Mocking `fetchGamePage` requires changing `src/utils/game-page.ts`.
- `reconcileLaunches` turns out to keep unpaired launches (then the "duplicates heal" reasoning in Step 3 is
  false — report before changing the order).

## Maintenance notes

- `unknown` is approximate when a launch is recorded during a check: it may be counted once as known and once
  as unknown, or not at all, until the next check. Acceptable; the next page load corrects it.
- Never call `saveLaunches`/`recordLaunches` from inside `withStorageLock(launchesKey(…))` — use `writeLaunches`.
