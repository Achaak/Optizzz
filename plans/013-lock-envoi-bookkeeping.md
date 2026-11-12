# Plan 013: Envois sent at the same time no longer overwrite each other's record

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- apps/extension/src/data/envois.ts apps/extension/src/features/optizzz-account/envois.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The browser extension (`apps/extension`), once linked to a Compte Optizzz, sends "Envois" to the site: one
list per category (convoys, floods, four states, the hunts log…). For each Joueur it keeps what it last sent
in one stored object, `SentState`, so that it can send the same encrypted blob again while an item does not
change. Every category reads that object, talks to the site, then writes the whole object back. Up to five
categories do this at the same moment (one change of the game's pages starts a 5-second timer per category),
so a category's write can erase what another just wrote: the next Envoi then encrypts and uploads items that
had not changed, and a state's "previous reading" can be the wrong one. After this plan every change to that
object is a read-modify-write under a lock, and each category only touches its own part.

## Current state

- `apps/extension/src/utils/storage-lock.ts` — the shared lock (whole file):

  ```ts
  // Read-modify-write of a stored key, one at a time. The Web Locks API serializes across every tab of the page's
  // origin (one game server); where it is missing (tests), a chain serializes within this script only.
  const chains = new Map<string, Promise<unknown>>();

  export function withStorageLock<T>(name: string, task: () => Promise<T>): Promise<T> { … }
  ```

  Exemplar of its use, `apps/extension/src/data/demandes.ts:75-85`:

  ```ts
  export function updateDemandeConvoys(
    origin: string,
    update: (kept: DemandeConvoys) => DemandeConvoys,
  ): Promise<DemandeConvoys> {
    return withStorageLock(key(origin), async () => {
      const kept = await loadDemandeConvoys(origin);
      const next = update(kept);
      if (JSON.stringify(next) !== JSON.stringify(kept)) await storage.setItem<DemandeConvoys>(key(origin), next);
      return next;
    });
  }
  ```

- `apps/extension/src/data/envois.ts` — what is stored. Relevant parts:

  ```ts
  // :32-33
  const SENT_KEY = "local:optizzzAccount:sent";
  const RELEVE_KEY = "session:optizzzAccount:releve";

  // :146-153
  export interface SentState {
    lists: Partial<Record<ListCategory, SentItems>>;
    lastSentAt: number | null;
    /** The categories that changed and could not be sent (the site did not answer): sent again at the next game page. */
    retry: ListCategory[];
    /** What stops the Envoi, to show in « Compte Optizzz ». */
    problem: string | null;
  }

  // :165 — export async function loadSent(joueur: string): Promise<SentState>   (reads SENT_KEY, one Joueur)

  // :175-178
  export async function storeSent(joueur: string, state: SentState): Promise<void> {
    const all = (await storage.getItem<Partial<Record<string, SentState>>>(SENT_KEY)) ?? {};
    await storage.setItem(SENT_KEY, { ...all, [joueur]: state });
  }

  // :211-214
  export async function storeReleve(spaceId: string, releve: SpaceReleve): Promise<void> {
    const all = (await storage.getItem<Partial<Record<string, SpaceReleve>>>(RELEVE_KEY)) ?? {};
    await storage.setItem(RELEVE_KEY, { ...all, [spaceId]: releve });
  }
  ```

- `apps/extension/src/features/optizzz-account/envois.ts` — the service. `storeSent` is called in four places,
  each after its own `loadSent`:

  ```ts
  // :472-475
  async function setProblem(joueur: string, problem: string | null, retry?: ListCategory[]) {
    const state = await loadSent(joueur);
    await storeSent(joueur, { ...state, problem, ...(retry && { retry }) });
  }

  // :632-664, end of sendList (after the network call `result`)
  const state = await loadSent(joueur);
  const retry = state.retry.filter((c) => c !== category);
  if (result.ok) {
    await storeSent(joueur, {
      ...state,
      lists: { ...state.lists, [category]: sent },
      lastSentAt: at.getTime(),
      retry,
      problem: retry.length > 0 ? state.problem : null,
    });
    await announceList({ … });
    return;
  }
  if (result.unlinked) return unlinked();
  if (result.error === "stale-key") {
    await refreshSpaces();
    return setProblem(joueur, MISSING_KEY);
  }
  await storeSent(joueur, {
    ...state,
    retry: [...retry, category],
    problem: result.error ? result.message : UNREACHABLE,
  });

  // :710-719, in the function that saves the Joueur's choices
  const joueur = joueurKey(server, pseudo);
  const state = await loadSent(joueur);
  const forgotten = STATE_CATEGORIES.filter((category) => !isSent(choices, category) || start.includes(category));
  if (forgotten.some((category) => state.lists[category]))
    await storeSent(joueur, {
      ...state,
      lists: Object.fromEntries(
        Object.entries(state.lists).filter(([category]) => !forgotten.includes(category as StateCategory)),
      ),
    });
  ```

  The other `loadSent` calls of the file (`:559`, `:735`, `:821`, `:946`) only read: leave them.

- Tests: `apps/extension/src/features/optizzz-account/envois.test.ts` (947 lines, vitest with
  `fakeBrowser.reset()` in `beforeEach`). There is no `apps/extension/src/data/envois.test.ts` yet.
- Conventions: English code and comments; WXT auto-imports nothing from `src/data/`, so imports are explicit
  with the `@/` alias (`import { withStorageLock } from "@/utils/storage-lock";`).

## Commands you will need

| Purpose       | Command                                                                               | Expected on success |
| ------------- | ------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm typecheck`                                                                      | exit 0              |
| Lint          | `pnpm lint`                                                                           | exit 0              |
| Account tests | `pnpm vitest run apps/extension/src/features/optizzz-account apps/extension/src/data` | all pass            |
| All tests     | `pnpm vitest run`                                                                     | all pass            |
| Dead code     | `pnpm knip`                                                                           | no new unused file  |

## Scope

**In scope**:

- `apps/extension/src/data/envois.ts`
- `apps/extension/src/data/envois.test.ts` (create)
- `apps/extension/src/features/optizzz-account/envois.ts`

**Out of scope**:

- `SPACES_KEY` (`storeSpaces`): it replaces the whole value, there is nothing to merge.
- `storeKeys`, `noteVersion`: written from one place at a time.
- What is stored and where (`storage.local` or `storage.session`): unchanged.
- `apps/extension/src/features/optizzz-account/demandes.ts`, `discord.ts`, `background.ts`.

## Git workflow

- Branch: `fix/lock-envoi-bookkeeping`.
- One commit, e.g. `fix(account): Envois sent together keep each other's record`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: Tests first

Create `apps/extension/src/data/envois.test.ts` (`beforeEach(() => fakeBrowser.reset())`, imports from
`./envois`):

1. "keeps what two categories write at the same time":

   ```ts
   const item = { digest: "d", blob: "b", keyVersion: 1, at: 1, expiresAt: 2 };
   await Promise.all([
     updateSent("s5|Messor", (state) => ({ ...state, lists: { ...state.lists, convoys: { a: item } } })),
     updateSent("s5|Messor", (state) => ({ ...state, lists: { ...state.lists, floods: { b: item } } })),
   ]);
   expect(Object.keys((await loadSent("s5|Messor")).lists).sort()).toEqual(["convoys", "floods"]);
   ```

2. "keeps each Joueur's record apart": two concurrent `updateSent` for `"s5|Messor"` and `"s2|Lasius"`, both
   are there afterwards.
3. "keeps the relève of two spaces written at the same time": two concurrent `storeReleve` for two space ids
   with `{ cursor: 1, rows: {} }`; `loadReleve` returns both.

**Verify**: `pnpm vitest run apps/extension/src/data/envois.test.ts` → fails (no `updateSent` yet).

### Step 2: `updateSent`, and the lock on the relève

In `apps/extension/src/data/envois.ts`:

1. Import `withStorageLock` from `@/utils/storage-lock`.
2. Replace `storeSent` with:

   ```ts
   /**
    * Changes what is kept for a Joueur, one change at a time: several categories are sent at the same moment, and
    * each one writes its own part without erasing the others'.
    */
   export function updateSent(joueur: string, update: (state: SentState) => SentState): Promise<void> {
     return withStorageLock(SENT_KEY, async () => {
       const state = await loadSent(joueur);
       const next = update(state);
       if (next === state) return;
       const all = (await storage.getItem<Partial<Record<string, SentState>>>(SENT_KEY)) ?? {};
       await storage.setItem(SENT_KEY, { ...all, [joueur]: next });
     });
   }
   ```

3. Wrap the body of `storeReleve` in `withStorageLock(RELEVE_KEY, async () => { … })` and return that promise.

**Verify**: `pnpm vitest run apps/extension/src/data/envois.test.ts` → 3 pass.

### Step 3: Switch the four writers

In `apps/extension/src/features/optizzz-account/envois.ts`, import `updateSent` instead of `storeSent`, then:

1. `setProblem`:
   `await updateSent(joueur, (state) => ({ ...state, problem, ...(retry && { retry }) }));`
2. End of `sendList`: delete the two lines `const state = await loadSent(joueur);` and
   `const retry = state.retry.filter(…)`, and add before `if (result.ok)`:
   `const others = (state: SentState) => state.retry.filter((c) => c !== category);`
   The success branch becomes:

   ```ts
   await updateSent(joueur, (state) => {
     const retry = others(state);
     return {
       ...state,
       lists: { ...state.lists, [category]: sent },
       lastSentAt: at.getTime(),
       retry,
       problem: retry.length > 0 ? state.problem : null,
     };
   });
   ```

   and the final write:

   ```ts
   await updateSent(joueur, (state) => ({
     ...state,
     retry: [...others(state), category],
     problem: result.error ? result.message : UNREACHABLE,
   }));
   ```

   Import the type `SentState` from `@/data/envois` if the file does not import it yet.

3. The choices function (`:710-719`): delete `const state = await loadSent(joueur);` and replace the `if` with:

   ```ts
   await updateSent(joueur, (state) =>
     forgotten.some((category) => state.lists[category])
       ? {
           ...state,
           lists: Object.fromEntries(
             Object.entries(state.lists).filter(([category]) => !forgotten.includes(category as StateCategory)),
           ),
         }
       : state,
   );
   ```

   Keep the `forgotten` constant where it is.

**Verify**: `grep -rn "storeSent(" apps/extension/src` → no match.
`pnpm typecheck && pnpm lint` → exit 0.
`pnpm vitest run apps/extension/src/features/optizzz-account` → all pass, with no test changed.

### Step 4: Full gate

**Verify**: `pnpm vitest run && pnpm knip` → all pass, no new unused export or file.

## Test plan

Three new tests in `apps/extension/src/data/envois.test.ts` (step 1). The 947 lines of
`features/optizzz-account/envois.test.ts` are the characterization tests: they must pass unchanged.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `grep -rn "storeSent(" apps/extension/src` returns nothing
- [ ] `grep -c "withStorageLock" apps/extension/src/data/envois.ts` → 3 (the import and two uses)
- [ ] `apps/extension/src/features/optizzz-account/envois.test.ts` is not modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- A test of `features/optizzz-account/envois.test.ts` fails and only passes by editing the test.
- `storeSent` has a caller outside the two in-scope files.
- An `updateSent` updater would need to `await` something: the lock must never be held across a network call.

## Maintenance notes

- The lock is per storage key, never held during a request to the site: only the final write is serialized.
- Not covered here: an Envoi or a relève still in flight when the player clicks « Se déconnecter » can write
  its record back after the keys were forgotten. Closing that needs a generation counter checked before each
  write; it was left out to keep this change small.
- Plan 015 edits the same service file (`unlinked`): run it after this one.
