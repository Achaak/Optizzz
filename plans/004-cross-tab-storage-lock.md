# Plan 004: Serialize read-modify-write of stored data across the tabs of a server

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- src/utils/storage-lock.ts src/data/end-times.ts src/data/levels.ts src/features/alerts/store.ts src/data/shared-states.ts`
> `src/data/shared-states.ts` is expected to have changed if plan 002 landed (a 4th parameter on
> `forgetFormerMembers`); that is fine. Any other mismatch with "Current state" is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002-guard-forget-former-members.md (both edit `src/data/shared-states.ts`)
- **Category**: bug
- **Planned at**: commit `9361968`, 2026-10-16

## Why this matters

Optizzz (WXT browser extension for Fourmizzz.fr) stores what it reads on game pages in `browser.storage.local`,
one key per server, each key an object that several pages update ("read, merge, write back"). Each content
script runs separately **in each tab**. Two modules try to serialize those writes with a module-level promise
chain (`let pendingWrite`) and claim in comments that it protects "two tabs" — it does not: each tab has its own
copy of the module. When two tabs of the same server load together (session restore, opening Construction and
Laboratoire side by side), each reads the old object and writes back its own version; the last one wins and
the other tab's update is reverted. Consequences: a reverted "end times" section means the « chantier terminé »
notification never fires; reverted levels feed wrong travel times and hunt plans. `storeLevels` has no
serialization at all.

All tabs of one server share the page origin (`https://s5.fourmizzz.fr`), and content scripts can use the
**Web Locks API** (`navigator.locks.request(name, callback)`), which serializes across every tab of that origin.
After this plan, one small helper does that, falling back to the current in-script chain where Web Locks are
missing (the test environment, happy-dom, returns `null` for `navigator.locks`).

## Current state

- `src/data/end-times.ts:28-42`:

  ```ts
  // Read-modify-write: two writes at once (two tabs' features, a page read again) must not drop a section.
  let pendingWrite: Promise<void> = Promise.resolve();

  export function storeSection(origin: string, section: Section): Promise<void> {
    const write = pendingWrite.then(async () => {
      const stored = (await storage.getItem<Partial<Record<EndKind, StoredSection>>>(key(origin))) ?? {};
      stored[section.kind] = {
        readAt: section.readAt.getTime(),
        items: section.items.map((item) => ({ label: item.label, endsAt: item.endsAt.getTime() })),
      };
      await storage.setItem(key(origin), stored);
    });
    pendingWrite = write.catch(() => undefined);
    return write;
  }
  ```

  `key(origin)` (line 13) is `` `local:endTimes:${host}:sections` ``.

- `src/features/alerts/store.ts:13-26` — same pattern for `STOCKS_KEY = "local:alerts:stocks"` (one key for
  **all** servers, written by content scripts of every server).

- `src/data/levels.ts:57-64` — no serialization:

  ```ts
  export async function storeLevels(origin: string, levels: StoredLevels, page?: LevelsPage, readAt = new Date()) {
    const stored = (await storage.getItem<StoredLevels>(storageKey(origin))) ?? {};
    await storage.setItem(storageKey(origin), { ...stored, ...levels });
    if (!page || Object.keys(levels).length === 0) return;
    const dates = (await storage.getItem<Partial<Record<LevelsPage, number>>>(readAtKey(origin))) ?? {};
    await storage.setItem(readAtKey(origin), { ...dates, [page]: readAt.getTime() });
  }
  ```

  Callers: `src/features/collect/index.ts:52` (Armee.php), `src/features/game-levels/index.ts:10`,
  `src/data/levels.ts:117` (background re-read).

- `src/data/shared-states.ts` — `setManualValue` (~line 157), `forgetFormerMembers` (~174),
  `rememberMyShare` (~183), `importStates` (~203) each do `readStored(origin, alliance)` then
  `storage.setItem(key(origin), …)` on `` `local:allianceSharing:${host}:states` `` with no serialization.

- `storage` is `import { storage } from "wxt/utils/storage"`. Tests use `fakeBrowser` from
  `wxt/testing/fake-browser` and `beforeEach(() => fakeBrowser.reset())` (see `src/data/end-times.test.ts`,
  `src/features/alerts/store.test.ts`).

- Conventions: English code/comments; one short comment line above non-obvious code; new shared helpers go in
  `src/utils/` with a sibling `*.test.ts` (e.g. `src/utils/wait-for-element.ts` + `.test.ts`).

## Commands you will need

| Purpose   | Command                                                                       | Expected on success |
| --------- | ----------------------------------------------------------------------------- | ------------------- |
| Typecheck | `pnpm typecheck`                                                              | exit 0              |
| Tests     | `pnpm vitest run src/utils/storage-lock.test.ts src/data src/features/alerts` | all pass            |
| All tests | `pnpm vitest run`                                                             | all pass            |
| Lint      | `pnpm lint`                                                                   | 0 errors            |
| Build     | `pnpm build && pnpm build:firefox`                                            | exit 0              |

## Scope

**In scope**:

- `src/utils/storage-lock.ts`, `src/utils/storage-lock.test.ts` (create)
- `src/data/end-times.ts`, `src/data/levels.ts`, `src/features/alerts/store.ts`, `src/data/shared-states.ts`
- Their existing test files, only to add concurrency tests: `src/data/levels.test.ts`, `src/data/shared-states.test.ts`

**Out of scope**:

- `src/data/launches.ts` and `src/data/on-way.ts` — plan 005 handles them and will reuse this helper.
- Changing storage key names or layouts (no migration in this plan).
- `src/features/alerts/store.ts` cross-**server** races (s2 and s5 tabs are different origins, so Web Locks
  cannot serialize them); a lost write there only reverts one server's stock to its previous reading until
  that server's next page load. Leave as is; fix the comment (Step 4).

## Git workflow

- Branch: `fix/cross-tab-storage-lock`.
- One commit per step is fine; e.g. `fix(data): serialize stored data writes across a server's tabs`.
- Pre-commit hook runs lint-staged, typecheck and tests: never `--no-verify`. Do not push.

## Steps

### Step 1: Create `src/utils/storage-lock.ts` (test first)

Tests in `src/utils/storage-lock.test.ts`:

1. "runs tasks with the same name one after the other": start two `withStorageLock("k", …)` tasks where the
   first awaits a manually resolved promise; assert the second has not started until the first resolves.
2. "runs the next task after one that fails": first task rejects; the returned promise rejects; the second
   task still runs and resolves.
3. "uses navigator.locks when the browser has it": stub with
   `vi.spyOn(navigator, "locks", "get").mockReturnValue({ request: vi.fn((_name, task) => task()) } as never)`
   (or `Object.defineProperty`); assert `request` was called with the name `"k"` and the task's result is returned.

Implementation:

```ts
// Read-modify-write of a stored key, one at a time. The Web Locks API serializes across every tab of the page's
// origin (one game server); where it is missing (tests), a chain serializes within this script only.
const chains = new Map<string, Promise<unknown>>();

export function withStorageLock<T>(name: string, task: () => Promise<T>): Promise<T> {
  const locks = globalThis.navigator?.locks as LockManager | null | undefined;
  if (locks) return locks.request(`optizzz:${name}`, task);
  const run = (chains.get(name) ?? Promise.resolve()).then(task, task);
  chains.set(
    name,
    run.catch(() => undefined),
  );
  return run;
}
```

(If `LockManager` is not in the TypeScript DOM lib used here, type `locks` minimally as
`{ request<T>(name: string, task: () => Promise<T>): Promise<T> } | null | undefined`.)

**Verify**: `pnpm vitest run src/utils/storage-lock.test.ts` → 3 pass. `pnpm typecheck` → exit 0.

### Step 2: Use it in `storeSection`

Replace the `pendingWrite` variable and chain in `src/data/end-times.ts` with
`return withStorageLock(key(origin), async () => { …same body… });`. Delete `pendingWrite`. Update the comment to:
`// Read-modify-write, one at a time across this server's tabs: a page read again must not drop another's section.`

**Verify**: `pnpm vitest run src/data/end-times.test.ts` → all pass; `grep -n pendingWrite src/data/end-times.ts` → nothing.

### Step 3: Use it in `storeLevels`

Wrap the whole body of `storeLevels` in `withStorageLock(storageKey(origin), async () => { … })` and return it
(both keys are updated inside one lock; the readAt key is per server too). Add a test in
`src/data/levels.test.ts`: call `storeLevels(ORIGIN, { dome: 3 })` and `storeLevels(ORIGIN, { weapons: 7 }, "laboratoire.php")`
**without awaiting the first**, then `await Promise.all(...)`, and assert `loadStoredLevels(ORIGIN)` contains both
`dome: 3` and `weapons: 7`. (Use the origin constant and key names the existing test file uses; check
`StoredLevels` for valid keys.)

**Verify**: `pnpm vitest run src/data/levels.test.ts` → all pass, including the new test.

### Step 4: Use it in `storeStock`

In `src/features/alerts/store.ts`, replace `pendingWrite` with `withStorageLock(STOCKS_KEY, …)`. Replace the
comment with:
`// Read-modify-write, one at a time across this server's tabs. Tabs of two servers (two origins) can still race: the`
`// loser keeps its previous stock until its next page load.`

**Verify**: `pnpm vitest run src/features/alerts` → all pass.

### Step 5: Use it in `shared-states.ts`

Wrap the read-modify-write bodies of `setManualValue`, `forgetFormerMembers`, `rememberMyShare` and
`importStates` in `withStorageLock(key(origin), async () => { … })`, returning the task's result (`importStates`
returns an `ImportReport`). Keep any early return (e.g. plan 002's guard) **inside** or **before** the lock —
both are fine, but do not change behaviour. Add one test: `importStates(…bob…)` and
`setManualValue(…"Ann"…)` started together then awaited with `Promise.all`; both are present afterwards.

**Verify**: `pnpm vitest run src/data/shared-states.test.ts` → all pass.

### Step 6: Full gate and builds

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm knip && pnpm build && pnpm build:firefox`
→ all exit 0. `grep -rn "pendingWrite" src` → nothing.

## Test plan

- `src/utils/storage-lock.test.ts`: ordering, failure isolation, Web Locks delegation.
- One concurrency test each in `levels.test.ts` and `shared-states.test.ts`. Existing end-times and alerts
  store tests must still pass unchanged.

## Done criteria

- [ ] `src/utils/storage-lock.ts` exists and is used by the 4 modules listed
- [ ] `grep -rn "pendingWrite" src` returns nothing
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`, `pnpm knip`, `pnpm build`, `pnpm build:firefox` exit 0
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `navigator.locks` is typed in a way that forces `as any` / `@ts-ignore`: report instead (the repo's lint is
  `typescript-eslint` strict; escape hatches are not welcome).
- A lock callback would need to call another function that takes the **same** lock (deadlock: Web Locks are not
  re-entrant). Check `importStates` / `setManualValue` do not call each other; if they do, report.
- Any existing test changes expectation, not just setup.

## Maintenance notes

- Web Locks are **not re-entrant**: never call a locked writer from inside another lock with the same name.
- The background service worker runs on the extension's origin, so its locks do not coordinate with content
  scripts. Today it only reads these keys; if it ever writes one, route that write through a content script or
  accept the race.
- Manual check worth doing once (Chrome and Firefox): open `construction.php` and `laboratoire.php` of one server
  at the same time, then check both sections in the « Prochaines fins » box. Firefox content scripts reach
  `navigator.locks` through the page's Xray wrapper; if it misbehaves there, the fallback chain still applies per tab.
- Plan 005 reuses `withStorageLock` for the flood launches.
