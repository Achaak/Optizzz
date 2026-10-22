# Plan 002: Never wipe the alliance's shared states on an empty or broken members read

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- apps/extension/src/data/shared-states.ts apps/extension/src/data/shared-states.test.ts apps/extension/src/features/alliance-sharing/AllianceSharing.tsx apps/extension/src/entrypoints/alliance-sharing.content/index.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9361968`, 2026-10-16

## Why this matters

Optizzz (browser extension for the game Fourmizzz.fr) has an « alliance sharing » view: members paste each
other's state (levels, army…) from a Discord channel, and the extension stores it per alliance, together
with values typed by hand. When the view opens on `alliance.php?Membres#partage`, it reads the members table
and **deletes everything stored for any pseudo not in that list**. If the read returns nothing — a game
markup change, a renamed column, the table not yet filled — every imported state and every hand-typed value
of the whole alliance is deleted, with no undo; members must paste again. After this plan, the cleanup only
runs when the members list is plausibly complete: non-empty, and containing the logged-in player.

## Current state

- `apps/extension/src/data/shared-states.ts:173-180` — the deletion:

  ```ts
  /** Forgets the members no longer on the members page; everything when the player is now in another alliance. */
  export async function forgetFormerMembers(
    origin: string,
    alliance: string,
    members: readonly string[],
  ): Promise<void> {
    const stored = await readStored(origin, alliance);
    const kept = new Set(members);
    const keep = <T>(byPseudo: Partial<Record<string, T>>) =>
      Object.fromEntries(Object.entries(byPseudo).filter(([pseudo]) => kept.has(pseudo)));
    await storage.setItem(key(origin), { ...stored, members: keep(stored.members), manual: keep(stored.manual) });
  }
  ```

  ("everything when the player is now in another alliance" is handled by `readStored`, lines 108–112, which
  returns an empty record when the stored alliance differs; keep that behaviour.)

- `apps/extension/src/features/alliance-sharing/AllianceSharing.tsx:113-121` — calls it as soon as `members` is non-null:

  ```ts
  // Former members are forgotten, and my own last share shows in my row.
  useEffect(() => {
    if (!alliance || !members) return;
    void (async () => {
      await forgetFormerMembers(origin, alliance, members);
      const mine = await loadMyLastShare(origin, alliance);
      if (mine) await importStates(origin, alliance, [mine]);
      await reload();
    })();
  }, [origin, alliance, members, reload]);
  ```

  Props (lines 18–25): `origin`, `alliance: string | null`, `members: string[] | null`.

- `apps/extension/src/entrypoints/alliance-sharing.content/index.tsx:52-91` — `mountAllianceSharing` reads
  `members = [...readMembersHuntingField(document).keys()]` once `#tabMembresAlliance` exists (line 88–90) and
  renders `<AllianceSharing origin={location.origin} alliance={alliance} members={members} />` (line 59).
  `readMembersHuntingField` (`packages/game/src/pages/alliance.ts:8-17`) silently skips rows whose pseudo or field cell
  is missing, so a layout change yields an empty map.

- `readLoggedInPseudo(document)` (`packages/game/src/pages/alliance.ts:19-23`) returns the logged-in player's pseudo
  from `#pseudo`, or null. It is already imported in this entrypoint (line 9) and used for « Mon état » (line 25).
  A correct members table of _my_ alliance always contains me.

- Tests: `apps/extension/src/data/shared-states.test.ts` uses `fakeBrowser` from `wxt/testing/fake-browser`
  (`beforeEach(() => fakeBrowser.reset())`), origin `https://s5.fourmizzz.fr`, helper `bob(readAt, weapons)`.
  Existing `describe("forgetting")` at lines 98–116 — both existing tests must keep passing unchanged
  **except** for the added argument.

- Conventions: English code and comments, French player-facing text, `@/` import alias, tests next to code.

## Commands you will need

| Purpose   | Command                                                         | Expected on success |
| --------- | --------------------------------------------------------------- | ------------------- |
| Typecheck | `pnpm typecheck`                                                | exit 0              |
| Tests     | `pnpm vitest run apps/extension/src/data/shared-states.test.ts` | all pass            |
| All tests | `pnpm vitest run`                                               | all pass            |
| Lint      | `pnpm lint`                                                     | 0 errors            |

## Scope

**In scope**:

- `apps/extension/src/data/shared-states.ts`
- `apps/extension/src/data/shared-states.test.ts`
- `apps/extension/src/features/alliance-sharing/AllianceSharing.tsx`
- `apps/extension/src/entrypoints/alliance-sharing.content/index.tsx`

**Out of scope**:

- `readMembersHuntingField` and other users of it (tdc-chain, alliance-map, members-columns).
- Any undo/backup feature for shared states (a larger product decision).
- Bounding pasted payloads (separate plan 007).

## Git workflow

- Branch: `fix/guard-forget-former-members`.
- Conventional Commits, e.g. `fix(alliance-sharing): keep shared states when the members list reads empty`.
- The pre-commit hook runs lint-staged, typecheck and tests: never `--no-verify`. Do not push.

## Steps

### Step 1: Write the failing tests first

In `apps/extension/src/data/shared-states.test.ts`, inside `describe("forgetting")`, add:

1. "keeps everything when the members list is empty": import Bob, set a manual value for Ann, call
   `forgetFormerMembers(ORIGIN, "ABC", [], "Me")`, assert Bob's state and Ann's value are still there.
2. "keeps everything when I am not in the members list": same setup, call
   `forgetFormerMembers(ORIGIN, "ABC", ["Carl"], "Me")`, assert nothing was removed.
3. "still forgets when my pseudo is unknown and the list is not empty": call with `["Carl"], null` and assert
   Bob and Ann are forgotten (fallback when `#pseudo` can't be read).

Update the two existing calls to pass a 4th argument that is in the list (e.g. `["Carl"]` → `["Carl"], "Carl"`
and `["Bob"]` → `["Bob"], "Bob"`) so their expectations stay valid.

**Verify**: `pnpm vitest run apps/extension/src/data/shared-states.test.ts` → the new tests fail (typecheck errors on the
argument count are expected at this point in the editor, vitest still runs).

### Step 2: Guard `forgetFormerMembers`

Change the signature to
`forgetFormerMembers(origin: string, alliance: string, members: readonly string[], me: string | null)` and
return early, **without writing**, when `members.length === 0` or when `me !== null && !members.includes(me)`.
Update the doc comment: "…only when `members` looks like a full read: not empty, and with me in it when my
pseudo is known."

**Verify**: `pnpm vitest run apps/extension/src/data/shared-states.test.ts` → all pass.

### Step 3: Pass the logged-in pseudo through

- `AllianceSharing.tsx`: add prop `me: string | null` (doc comment: "The logged-in player's pseudo; null when
  unreadable.") and call `forgetFormerMembers(origin, alliance, members, me)`; add `me` to the effect's deps.
- `alliance-sharing.content/index.tsx`, in `mountAllianceSharing`: `const me = readLoggedInPseudo(document);`
  next to `const alliance = …` and pass `me={me}` in `render`.

**Verify**: `pnpm typecheck` → exit 0; `grep -rn "forgetFormerMembers(" src` shows every call with 4 arguments.

### Step 4: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run` → all exit 0.

## Test plan

Three new cases in `apps/extension/src/data/shared-states.test.ts` (Step 1); two existing ones adapted. Pattern: the
existing `describe("forgetting")` block.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `apps/extension/src/data/shared-states.test.ts` has the 3 new tests, passing
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `forgetFormerMembers` has callers other than `AllianceSharing.tsx` (`grep -rn forgetFormerMembers src`).
- `readStored` no longer resets on an alliance change (the "another alliance" test fails after Step 2).
- You find the members list is also passed to code that deletes other stored data; report it.

## Maintenance notes

- A partially filled table that still contains me can still forget members; the risk is much lower than an
  empty read. If that is ever observed, read the members when the row count is stable rather than on the
  first mutation (`waitForElement` in `apps/extension/src/utils/wait-for-element.ts`).
- Any future "forget" over stored data driven by a page read should carry the same "the read looks complete"
  guard.
