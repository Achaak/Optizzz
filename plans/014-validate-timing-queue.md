# Plan 014: The timing queue read from the game's page is checked, and old verdicts are dropped

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- apps/extension/src/features/timing/sent.ts apps/extension/src/features/timing/sent.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The browser extension has a feature that times an attack to the second. When the player sends the attack, the
game leaves the page at once, so the extension first notes the launch in the tab's `sessionStorage`, then reads
it back on the next page. `sessionStorage` belongs to the game's page: the game's own scripts, and anything
they load, can write there. Today the extension parses that entry and trusts its shape (`as TimedLaunch[]`):
a wrong `clock` becomes a wait of any length before a request, and a wrong `target` or date ends up in the
extension's own storage. Separately, the verdicts it keeps (`local:timing:<host>:attacks`) are only filtered
when read, never removed, so that key grows with every timed attack. The same pattern for floods
(`apps/extension/src/data/launches.ts`) already checks every field and caps the queue; this plan does the same
here, and prunes what is past its date.

## Current state

- `apps/extension/src/features/timing/sent.ts` — relevant parts:

  ```ts
  // :9-18
  /** An attack sent with the block on: noted at the click, before the game leaves the page. */
  export interface TimedLaunch {
    target: string;
    /** The arrival the block aimed at (server time, ms). */
    aimedAt: number;
    /** The game's clock as the block measured it: when to read Armee.php. */
    clock: ServerClock;
    /** When the form was sent, on the PC's clock. */
    sentAt: number;
  }

  // :28-34
  const QUEUE_KEY = "optizzz-timing-queue";
  /** A launch the game still does not list after this was refused or cancelled. */
  const FIND_WITHIN_MS = 2 * 60_000;
  /** The listed attack paired with a launch arrives this close to the aimed arrival, at most. */
  const PAIR_WITHIN_MS = 10 * 60_000;
  /** The verdict stays on the line until this long after the arrival. */
  const KEEP_AFTER_MS = 60 * 60_000;

  // :38-45
  function readQueue(session: Storage): TimedLaunch[] {
    try {
      const parsed: unknown = JSON.parse(session.getItem(QUEUE_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as TimedLaunch[]) : [];
    } catch {
      return [];
    }
  }

  // :66-73, start of checkTimedLaunches(origin, session, io)
  const queue = readQueue(session);
  const latest = queue.at(-1);
  if (!latest) return;
  await io.wait(requestDelay(io.now(), latest.clock));
  const response = await io.fetch("/Armee.php", { cache: "no-store" });
  const serverDate = Date.parse(response.headers.get("date") ?? "");
  if (!response.ok || !Number.isFinite(serverDate)) return;

  // :78-97, end of checkTimedLaunches
  await withStorageLock(attacksKey(origin), async () => {
    const stored = (await storage.getItem<TimedAttack[]>(attacksKey(origin))) ?? [];
    const taken = new Set(stored.map((attack) => attack.attackId));
    const found: TimedAttack[] = [];
    const left = queue.filter((launch) => { … });
    if (found.length > 0) await storage.setItem(attacksKey(origin), [...stored, ...found]);
    writeQueue(session, left);
  });

  // :100-104
  /** The timed attacks whose verdict is still shown (`now`: server time, ms). */
  export async function loadTimedAttacks(origin: string, now: number): Promise<TimedAttack[]> {
    const stored = (await storage.getItem<TimedAttack[]>(attacksKey(origin))) ?? [];
    return stored.filter((attack) => attack.arrivesAt + KEEP_AFTER_MS > now);
  }
  ```

- `packages/game/src/timing.ts:16-21`:

  ```ts
  export interface ServerClock {
    offsetMs: number;
    errorMs: number;
    /** Half the median round trip: how long a request takes to reach the server. */
    oneWayMs: number;
  }
  ```

- The pattern to match, `apps/extension/src/data/launches.ts:71-104`:

  ```ts
  /** More cannot be sent between two page loads: anything beyond is not ours. */
  const MAX_QUEUED = 20;

  const isStoredLaunch = (value: unknown, now: number): value is StoredLaunch => {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return ( … typeof v.target === "string" && v.target.length <= 100 && … );
  };

  const readQueue = (session: Storage): StoredLaunch[] => {
    try {
      const parsed: unknown = JSON.parse(session.getItem(QUEUE_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.filter((value: unknown) => isStoredLaunch(value, now)).slice(0, MAX_QUEUED);
    } catch {
      return [];
    }
  };
  ```

- Tests: `apps/extension/src/features/timing/sent.test.ts`. Its fixtures (lines 7-36): `origin`, `serverDate`,
  `arrival`, `clock = { offsetMs: 0, errorMs: 200, oneWayMs: 100 }`, `fakeIo()` (records `waits` and `urls`).
  `beforeEach` resets `fakeBrowser` and clears `sessionStorage`. The queue's key in `sessionStorage` is
  `"optizzz-timing-queue"`.

## Commands you will need

| Purpose      | Command                                              | Expected on success |
| ------------ | ---------------------------------------------------- | ------------------- |
| Typecheck    | `pnpm typecheck`                                     | exit 0              |
| Lint         | `pnpm lint`                                          | exit 0              |
| Timing tests | `pnpm vitest run apps/extension/src/features/timing` | all pass            |
| All tests    | `pnpm vitest run`                                    | all pass            |

## Scope

**In scope**:

- `apps/extension/src/features/timing/sent.ts`
- `apps/extension/src/features/timing/sent.test.ts`

**Out of scope**:

- `apps/extension/src/features/timing/clock.ts`, `mount.ts`, `index.ts`.
- `packages/game/src/timing.ts` (`requestDelay`, `verdictText`).
- `apps/extension/src/data/launches.ts`: the exemplar, not to be changed or imported from.

## Git workflow

- Branch: `fix/validate-timing-queue`.
- One commit, e.g. `fix(timing): check the queue read from the page, and drop verdicts past their date`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: Tests first

In `sent.test.ts`, inside `describe("checkTimedLaunches", …)`, add:

1. "reads nothing when what the page left is not a timed launch": write
   `sessionStorage.setItem("optizzz-timing-queue", JSON.stringify([{ target: "Cible_1", aimedAt: arrival, sentAt: serverDate, clock: { offsetMs: 0, errorMs: 200, oneWayMs: "1e12" } }, { target: 5 }, "x", null]))`,
   run `checkTimedLaunches(origin, sessionStorage, io)`; expect `io.waits` and `io.urls` to be empty.
2. "takes twenty launches at most": write 25 valid launches for target `"Nobody"` with
   `sentAt: serverDate - 2000`; after `checkTimedLaunches`, `JSON.parse(sessionStorage.getItem("optizzz-timing-queue") ?? "[]")`
   has length 20 (none is listed by the game's page, all are younger than two minutes).
3. "drops the verdicts past their date when it stores a new one": first store an old verdict directly,
   `await storage.setItem("local:timing:s5.fourmizzz.fr:attacks", [{ attackId: 1, aimedAt: 0, arrivesAt: serverDate - 2 * 60 * 60_000 }])`
   (`import { storage } from "wxt/utils/storage"`), then run the scenario of the first existing test of the
   describe; afterwards `await storage.getItem("local:timing:s5.fourmizzz.fr:attacks")` holds exactly one
   entry, whose `arrivesAt` is `arrival`.

**Verify**: `pnpm vitest run apps/extension/src/features/timing/sent.test.ts` → the 3 new tests fail.

### Step 2: The guard and the cap

In `sent.ts`, above `readQueue`, add:

```ts
/** More cannot be sent between two page loads: anything beyond is not ours. */
const MAX_QUEUED = 20;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** The tab's sessionStorage is the game's page too: only what has the shape of a launch is taken. */
const isTimedLaunch = (value: unknown): value is TimedLaunch => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const clock = v.clock as Record<string, unknown> | null | undefined;
  return (
    typeof v.target === "string" &&
    v.target.length <= 100 &&
    isFiniteNumber(v.aimedAt) &&
    isFiniteNumber(v.sentAt) &&
    typeof clock === "object" &&
    clock !== null &&
    isFiniteNumber(clock.offsetMs) &&
    isFiniteNumber(clock.errorMs) &&
    isFiniteNumber(clock.oneWayMs)
  );
};
```

and make `readQueue` return `Array.isArray(parsed) ? parsed.filter(isTimedLaunch).slice(-MAX_QUEUED) : []`
(the newest twenty: `checkTimedLaunches` reads the clock of the last one).

**Verify**: tests 1 and 2 of step 1 pass.

### Step 3: Prune on write

In the `withStorageLock` block of `checkTimedLaunches`, replace the `setItem` line with:

```ts
// The verdicts past their date go with the write: nothing else ever removes them.
const kept = stored.filter((attack) => attack.arrivesAt + KEEP_AFTER_MS > serverDate);
if (found.length > 0 || kept.length < stored.length) await storage.setItem(attacksKey(origin), [...kept, ...found]);
```

**Verify**: `pnpm vitest run apps/extension/src/features/timing` → all pass, including the 3 new tests.

### Step 4: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run` → exit 0.

## Test plan

Three tests in `sent.test.ts` (step 1): a malformed queue, the cap, the pruning. The existing six tests of the
file must pass unchanged.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `grep -n "as TimedLaunch\[\]" apps/extension/src/features/timing/sent.ts` returns nothing
- [ ] Only the two in-scope files are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `readQueue` or the `withStorageLock` block no longer match the excerpts.
- An existing test of `sent.test.ts` fails after step 2: a real launch does not have the shape the guard expects.
- ESLint refuses the cast to `Record<string, unknown>`: copy the exact form used in
  `apps/extension/src/data/launches.ts:79-80` rather than disabling the rule.

## Maintenance notes

- A field added to `TimedLaunch` or `ServerClock` must be added to `isTimedLaunch`, or launches noted by a
  newer version would be dropped silently.
- `requestDelay` itself is not bounded here: with finite inputs it returns less than a second by construction
  (it aims at the start of the next server second). If that ever changes, bound the wait in `checkTimedLaunches`.
