# Plan 015: A token removed on the site makes the extension forget as much as « Se déconnecter »

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- apps/extension/src/features/optizzz-account/envois.ts apps/extension/src/features/optizzz-account/envois.test.ts`
> Plan 013 edits `envois.ts` before this one: its changes (`updateSent`) are expected. Compare only the
> excerpts below; on a mismatch there, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/013-lock-envoi-bookkeeping.md (same file)
- **Category**: bug
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The browser extension can be linked to a Compte Optizzz with a token. The link ends in two ways: the player
clicks « Se déconnecter » in the extension, or removes the extension from their account page on the site, after
which the site answers 401 to that token. The first way forgets everything read with the alliance's key. The
second forgets less: the alliance's chain roles (encrypted) and the Discord webhook record with its answers
stay in the extension's storage. Both ways should leave the same state. After this plan, a 401 runs the same
cleanup as « Se déconnecter », plus forgetting the link itself.

## Current state

- `apps/extension/src/features/optizzz-account/envois.ts`, inside `envoiService({ now, fetch, permitted, crypto, notify, later, discord })`:

  ```ts
  // :434-438
  /** The token was removed from /account: the extension forgets it, and the Clé d'alliance with it. */
  async function unlinked() {
    await forgetLink();
    await forgetKeys();
  }

  // :964-969
  /** « Se déconnecter »: the Clé d'alliance goes, with what was read with it and the webhook it opened. */
  async function forget(): Promise<void> {
    await forgetKeys();
    await forgetChainRoles();
    await discord.forget();
  }
  ```

  `unlinked()` is called wherever the site answers 401 (`:449`, `:655`, `:775`, `:806`) and is passed to the
  Demandes service (`:441`, `demandeService({ now, fetch, crypto, link, unlinked })`). `forget` is a function
  declaration in the same closure, so `unlinked` can call it although it is written further down.

- `apps/extension/src/features/optizzz-account/api.ts:124` — `if (response.status === 401) return { ok: false, unlinked: true };`
- `apps/extension/src/data/optizzz-account.ts:39-42` — `forgetLink()` removes the link and the account's
  Players. `apps/extension/src/data/chain-roles.ts:27` — `forgetChainRoles()`.
- Tests: `apps/extension/src/features/optizzz-account/envois.test.ts`. The fake site is the function that
  builds `fetch` (around lines 55-160): it keeps flags such as `let offline`, with setters returned at the end
  (`setOffline: (v: boolean) => (offline = v)`), and its `fetch` starts with:

  ```ts
  calls.push({ path: pathname, method, body });
  if (offline) return Promise.reject(new TypeError("Failed to fetch"));
  ```

  The test to model on is "takes up the chain's roles of the space, opened for the game's pages, and forgets
  them with the key" (line 511): it sets chain roles with `site.setChainRoles([{ spaceId: SPACE, blob, revision: 3 }])`,
  stores a key with `await storeKeys(SPACE, [KEY_1], null)`, runs `await service().releve("alarm")`, and reads
  `await loadChainRoles(SPACE)`.

## Commands you will need

| Purpose       | Command                                                       | Expected on success |
| ------------- | ------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm typecheck`                                              | exit 0              |
| Lint          | `pnpm lint`                                                   | exit 0              |
| Account tests | `pnpm vitest run apps/extension/src/features/optizzz-account` | all pass            |
| All tests     | `pnpm vitest run`                                             | all pass            |

## Scope

**In scope**:

- `apps/extension/src/features/optizzz-account/envois.ts`
- `apps/extension/src/features/optizzz-account/envois.test.ts`

**Out of scope**:

- `apps/extension/src/features/optizzz-account/background.ts`, `demandes.ts`, `discord.ts`, `api.ts`.
- The Joueur's Envoi choices (`CHOICES_KEY` in `apps/extension/src/data/envois.ts`): they stay after
  unlinking today, in both ways; whether they should is a product decision, not part of this plan.
- The highest key version seen per space (`VERSIONS_KEY`): kept on purpose, even after « Se déconnecter ».

## Git workflow

- Branch: `fix/revoked-token-forgets-everything`.
- One commit, e.g. `fix(account): a token removed on the site forgets what « Se déconnecter » forgets`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: A failing test

In `envois.test.ts`:

1. In the fake site, add a flag `let revoked = false;`, the line
   `if (revoked) return Promise.resolve(new Response(null, { status: 401 }));` right after the `offline` line,
   and a setter `setRevoked: (v: boolean) => (revoked = v),` next to `setOffline`.
2. In `describe("the relève", …)`, add "forgets the chain's roles and the link when the site no longer knows
   the token": set chain roles and a key as the test of line 511 does, run `await service().releve("alarm")`,
   check `await loadChainRoles(SPACE)` is not null; then `site.setRevoked(true)`,
   `await service().releve("alarm")`, and expect `await loadChainRoles(SPACE)` to be null,
   `await loadKeys(SPACE, NOW)` to be null and `await loadLink()` to be null (`loadLink` comes from
   `@/data/optizzz-account`; `loadKeys` and `loadChainRoles` are already imported).

**Verify**: `pnpm vitest run apps/extension/src/features/optizzz-account/envois.test.ts` → the new test fails
on the chain roles, the others pass.

### Step 2: One cleanup for both ways

In `envois.ts`, change `unlinked` to:

```ts
/** The token was removed from /account: the extension forgets it, and everything « Se déconnecter » forgets. */
async function unlinked() {
  await forgetLink();
  await forget();
}
```

**Verify**: `pnpm vitest run apps/extension/src/features/optizzz-account` → all pass.

### Step 3: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run` → exit 0.

## Test plan

One new test (step 1). It fails before step 2 and passes after.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `grep -n "await forget();" apps/extension/src/features/optizzz-account/envois.ts` → one line, inside `unlinked`
- [ ] Only the two in-scope files are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `unlinked` or `forget` no longer match the excerpts (apart from plan 013's changes elsewhere in the file).
- The relève does not call the site at all once the fake answers 401 on the first request, so the new test
  cannot reach `unlinked`: report which call returns first instead of calling `unlinked` from the test.
- A lint rule refuses calling `forget` before its declaration: move `unlinked` below `forget` only if no other
  function between them needs it earlier; otherwise report.

## Maintenance notes

- `discord.forget()` clears the stored webhooks and answers; the Discord service's in-memory queue
  (`discord.ts`, `queues`) still holds the old token until the background script restarts. A line waiting
  there during a rate limit could still be posted. Low stakes; clearing it needs a change in `discord.ts`.
- Anything new that « Se déconnecter » must forget goes in `forget()`, and is then covered by both ways.
