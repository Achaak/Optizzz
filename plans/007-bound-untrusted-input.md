# Plan 007: Check and bound the data Optizzz takes from pasted text and from the page's sessionStorage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- apps/extension/src/data/launches.ts apps/extension/src/data/launches.test.ts apps/extension/src/features/alliance-sharing/share-text.ts apps/extension/src/features/alliance-sharing/share-text.test.ts`
> `apps/extension/src/data/launches.ts` and its test are expected to have changed if plan 005 landed (`recordLaunches`,
> `flushQueuedLaunches` order). Any other mismatch with "Current state" is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/005-keep-flood-launches.md (same file `apps/extension/src/data/launches.ts`)
- **Category**: security
- **Planned at**: commit `9361968`, 2026-10-16

## Why this matters

Optizzz (browser extension for Fourmizzz.fr) takes two kinds of data it does not control and saves them in its
own trusted storage without bounds:

1. **The flood launch queue** in the page's `sessionStorage` (key `optizzz-flood-queue`). Any script running on
   fourmizzz.fr — the game's own, or injected content — can write that key; Optizzz casts it to its launch type
   and stores every entry. Those launches drive the flood plan, the « attaques en route » list and the targets'
   « Flood max » column.
2. **The alliance sharing text**, pasted by the player from a Discord channel that any member writes to. It is
   validated with zod, but any integer is accepted as a date: a share dated far in the future for a member's
   pseudo becomes that member's "latest" state forever, and their real shares are then reported as « inchangé »
   until the data is cleared. Strings and arrays have no length limit.

Copy-paste spoofing between members is accepted by design (`docs/features/partage-alliance.md`); the
**far-future lock-in** and the unbounded sizes go beyond it. After this plan, malformed or implausible entries
are dropped (and named to the player for shares), and sizes are capped.

## Current state

- `apps/extension/src/data/launches.ts:47-57`:

  ```ts
  // The game leaves the page as soon as the form is sent: an asynchronous write could be lost. The launch is first
  // written synchronously in the tab's sessionStorage, then moved at the next page load.
  const QUEUE_KEY = "optizzz-flood-queue";

  const readQueue = (session: Storage): StoredLaunch[] => {
    try {
      return JSON.parse(session.getItem(QUEUE_KEY) ?? "[]") as StoredLaunch[];
    } catch {
      return [];
    }
  };
  ```

  `StoredLaunch` = `{ targetId: number; target: string; ants: number; take: number; arrivesAt: number }`
  (lines 6–17). `launches.ts` is loaded on **every** game page (the flood feature runs everywhere), so do **not**
  add `zod` here (a separate effort is trying to keep zod out of the every-page bundle): write a small type guard.

- `apps/extension/src/features/alliance-sharing/share-text.ts:9-34` — zod `payloadSchema` (`s`, `a`, `p` strings; `t` int minutes
  since 1970; optional `f`, `w`, `b`, `r` level arrays, `c` works `[index|name, level, endsAtMinutes]`, `m` army
  `{ n, u?, i, r? }`). `fromMinutes(minutes)` → `Date`. `MAX_LENGTH = 2000` (one Discord message, used when
  _writing_). `parseShares(text, context)` (lines 210–235) decodes each `[optizzz:v1:…]` data line and pushes a
  reason to `ignored` for skipped ones, in French, e.g. `` `${state.pseudo} : autre serveur (${state.server})` ``.
  `ShareContext` = `{ server; alliance; members }` (lines 191–196). Only caller:
  `apps/extension/src/features/alliance-sharing/AllianceSharing.tsx:137`.
- `BUILDINGS`, `RESEARCH` (`@/game/levels`), `UNITS` (`@/game/army/units`) are the arrays the level/unit arrays index.
- Tests: `apps/extension/src/data/launches.test.ts` (`describe("queued launches")`, `sessionStorage.clear()` in `beforeEach`);
  `apps/extension/src/features/alliance-sharing/share-text.test.ts` (`state` fixture dated `2026-10-09T11:36:00Z`,
  `context = { server: "s5", alliance: "ABC", members: ["Éloïse", "Bob"] }`, round-trip via `formatShare` then
  `parseShares`; "reports a damaged data line" at ~line 132 is the pattern for rejections).
- Player-facing text is French and addresses the player as « vous ».

## Commands you will need

| Purpose   | Command                                                                                                 | Expected on success |
| --------- | ------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck | `pnpm typecheck`                                                                                        | exit 0              |
| Tests     | `pnpm vitest run apps/extension/src/data/launches.test.ts apps/extension/src/features/alliance-sharing` | all pass            |
| All tests | `pnpm vitest run`                                                                                       | all pass            |
| Lint      | `pnpm lint`                                                                                             | 0 errors            |

## Scope

**In scope**: `apps/extension/src/data/launches.ts`, `apps/extension/src/data/launches.test.ts`, `apps/extension/src/features/alliance-sharing/share-text.ts`,
`apps/extension/src/features/alliance-sharing/share-text.test.ts`.

**Out of scope**:

- The share format version (`v1`) and what it carries; writing (`formatShare`) stays unchanged.
- `importStates` merge rules in `apps/extension/src/data/shared-states.ts`.
- `AllianceSharing.tsx` (the `now` defaults inside `parseShares`; no caller change needed).

## Git workflow

- Branch: `fix/bound-untrusted-input`. Commit e.g. `fix(alliance-sharing): reject shares dated in the future`.
- Pre-commit hook runs lint-staged, typecheck and tests: never `--no-verify`. Do not push.

## Steps

### Step 1: Validate the launch queue (test first)

Tests in `describe("queued launches")`:

1. "ignores entries that are not launches": `sessionStorage.setItem("optizzz-flood-queue", JSON.stringify([{ targetId: "x" }, 5, null, <one valid launch>]))`,
   flush, assert only the valid launch is stored.
2. "ignores a queue that is not a list": set `'{"a":1}'`; flush; nothing stored, no throw.
3. "keeps at most 20 queued launches": queue 25 valid launches; after flush, 20 stored.
4. "ignores a launch arriving more than 30 days ahead": one valid, one with `arrivesAt` = now + 31 days; only the first is kept.

Implementation in `launches.ts`:

```ts
/** More cannot be sent between two page loads: anything beyond is not ours. */
const MAX_QUEUED = 20;
const MAX_AHEAD = 30 * 24 * 60 * 60_000;

const isStoredLaunch = (value: unknown, now: number): value is StoredLaunch => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(v.targetId) &&
    typeof v.target === "string" &&
    v.target.length <= 100 &&
    Number.isSafeInteger(v.ants) &&
    (v.ants as number) >= 0 &&
    Number.isSafeInteger(v.take) &&
    (v.take as number) >= 0 &&
    typeof v.arrivesAt === "number" &&
    v.arrivesAt <= now + MAX_AHEAD
  );
};
```

`readQueue` parses, returns `[]` unless `Array.isArray`, then `.filter((v) => isStoredLaunch(v, Date.now())).slice(0, MAX_QUEUED)`.
(Prettier will reformat; write it however the linter accepts. Avoid `as` casts beyond the one for indexing if
`typescript-eslint` complains — use `"targetId" in value` checks instead.)

**Verify**: `pnpm vitest run apps/extension/src/data/launches.test.ts` → all pass, 4 new.

### Step 2: Bound the share payload (test first)

Tests in `share-text.test.ts`, new `describe("parseShares limits")`. Build a data line from a hand-made payload:
`` `[optizzz:v1:${btoa(JSON.stringify(payload)).replace(/=+$/, "")}]` `` (only ASCII in these payloads so `btoa` is safe).

1. "skips a share dated in the future": payload with `t` = minutes of `now + 1 h`; call
   `parseShares(line, { ...context, now })`; `states` is empty and `ignored` contains `"Bob : date dans le futur"`.
2. "accepts a share dated a few minutes ahead" (clock skew): `t` = now + 2 min → accepted.
3. "rejects oversized fields": `p` of 200 chars → `ignored` contains `"Ligne Optizzz illisible"`.
4. "rejects more levels than the game has": `b` with `BUILDINGS.length + 1` entries → illisible.

Implementation:

- In `payloadSchema`: `s: z.string().max(20)`, `a: z.string().max(20)`, `p: z.string().max(50)`;
  `t: z.number().int().min(MIN_MINUTES)` where `MIN_MINUTES = toMinutes(new Date("2020-01-01T00:00:00Z"))`
  (define with the other constants, after `toMinutes`; move `levelsSchema`/`payloadSchema` below it if needed);
  `b: levelsSchema.max(BUILDINGS.length)`, `r: levelsSchema.max(RESEARCH.length)`;
  `c: z.array(…).max(LEVELS.length)` and the work-name string `.max(60)`; `m.u: z.array(…).max(UNITS.length)`.
- `ShareContext` gains `/** Defaults to the current time. */ now?: Date`.
- In `parseShares`, add `const now = context.now ?? new Date();` at the top, and in the `if / else if` chain of
  the data-line loop add, **after** the `!member` branch and before the final `else`:
  `else if (state.readAt.getTime() > now.getTime() + 5 * MINUTE) ignored.push(`${member} : date dans le futur`);`
  (`member` is the members-page spelling of the pseudo at that point).

**Verify**: `pnpm vitest run apps/extension/src/features/alliance-sharing` → all pass, including the existing "fits in one Discord
message" and round-trip tests.

### Step 3: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm knip` → all exit 0.

## Test plan

8 new tests (4 per file) as listed. Existing round-trip tests prove real shares are still accepted.

## Done criteria

- [ ] `grep -n "as StoredLaunch\[\]" apps/extension/src/data/launches.ts` returns nothing
- [ ] `grep -n "date dans le futur" apps/extension/src/features/alliance-sharing/share-text.ts` returns one line
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`, `pnpm knip` exit 0
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- An existing share-text test fails because a real field exceeds the new limits (e.g. alliance tags or server
  names longer than 20): report the real maximum instead of loosening silently.
- `formatShare`'s own output for the `state` fixture is rejected by the new schema.
- Plan 005 has not landed and `flushQueuedLaunches` still removes the queue before storing (do 005 first).

## Maintenance notes

- Limits are deliberately generous; if the game allows longer pseudos or tags, raise them with a test.
- A share's `readAt` ≤ now + 5 min only protects new imports. States already stored with a future date stay
  until the member leaves the alliance or the data is cleared; a one-off cleanup is not part of this plan.
