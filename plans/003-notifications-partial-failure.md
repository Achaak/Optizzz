# Plan 003: A failing notification no longer makes the others repeat every minute

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- src/features/alerts/background.ts src/features/alerts/notifications.ts src/features/alerts/notifications.test.ts`
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

Optizzz (browser extension for Fourmizzz.fr) has a background script that, every minute, computes due
notifications (famine, full warehouse, construction finished, hunt back) and remembers which ones it already
sent, so each event is announced once. Today the "already sent" list is saved only **after** the whole loop of
`browser.notifications.create` calls. If any one call throws (permission revoked mid-loop, a browser-specific
option error), the loop aborts, nothing is saved, and every notification already shown in that run is shown
again one minute later — repeating until a whole run succeeds. After this plan, each notification is recorded
as soon as it is shown, a failing one is logged and skipped, and the list is always saved.

## Current state

- `src/features/alerts/background.ts:31-56` — `sendNotifications`:

  ```ts
  const stored = (await storage.getItem<SentNotifications>(SENT_KEY)) ?? {};
  const sent = Object.fromEntries(
    Object.entries(stored).filter(([, entry]) => entry && now.getTime() - entry.at < SENT_KEPT),
  );
  const notices = dueNotifications({ servers, ends, settings, sent }, now);
  for (const notice of notices) {
    await browser.notifications.create(notice.id, {
      type: "basic",
      iconUrl: browser.runtime.getURL("/icons/128.png"),
      title: "Optizzz",
      message: notice.message,
    });
    sent[notice.id] = { at: now.getTime(), url: notice.url };
  }
  await storage.setItem(SENT_KEY, sent);
  ```

  Errors bubble to `refresh()` (lines 66–78), which only logs `[Optizzz] could not update the alerts`.
  `background.ts` has no test file (it calls `browser.*` APIs directly).

- `src/features/alerts/notifications.ts` — pure logic, tested in `notifications.test.ts`. Relevant types:

  ```ts
  export type SentNotifications = Partial<Record<string, { at: number; url: string }>>;
  export interface Notice {
    id: string;
    message: string;
    url: string;
  }
  export function dueNotifications(input: NotificationInput, now: Date): Notice[];
  ```

- Conventions: English code/comments, console messages prefixed `[Optizzz]` and written as
  `console.warn("[Optizzz] could not …", error)` (see `src/data/launches.ts` `queueLaunch`). Tests: vitest,
  `describe`/`it`/`expect`; `vi.fn()` is available from `vitest`.

## Commands you will need

| Purpose   | Command                               | Expected on success |
| --------- | ------------------------------------- | ------------------- |
| Typecheck | `pnpm typecheck`                      | exit 0              |
| Tests     | `pnpm vitest run src/features/alerts` | all pass            |
| All tests | `pnpm vitest run`                     | all pass            |
| Lint      | `pnpm lint`                           | 0 errors            |

## Scope

**In scope**:

- `src/features/alerts/notifications.ts` (add `deliverNotices`)
- `src/features/alerts/notifications.test.ts` (add tests)
- `src/features/alerts/background.ts` (use it)

**Out of scope**:

- `dueNotifications` and the rules for which notifications are due.
- The badge (`refreshBadge`), the alarm, the permission flow.

## Git workflow

- Branch: `fix/notifications-partial-failure`.
- Commit e.g. `fix(alerts): remember each notification as soon as it is shown`.
- Pre-commit hook runs lint-staged, typecheck and tests: never `--no-verify`. Do not push.

## Steps

### Step 1: Add a testable delivery helper (tests first)

In `notifications.test.ts`, add `describe("deliverNotices", …)` with:

1. "records each notice shown": two notices, `create = vi.fn().mockResolvedValue(undefined)`; result contains
   both ids with `{ at: now.getTime(), url }`, and `create` was called twice.
2. "skips a notice that fails, and still records the others": `create` rejects for the first notice only;
   result contains only the second id; the call does **not** throw.
3. "keeps what was already sent": start from `sent = { old: { at: 1, url: "u" } }`; it is still in the result.

Then in `notifications.ts` add:

```ts
/**
 * Shows each notice with `show` and returns `sent` with the ones shown: one that fails is logged and left out,
 * to be tried again next time, without stopping the others.
 */
export async function deliverNotices(
  notices: readonly Notice[],
  sent: SentNotifications,
  now: Date,
  show: (notice: Notice) => Promise<unknown>,
): Promise<SentNotifications> {
  const updated = { ...sent };
  for (const notice of notices) {
    try {
      await show(notice);
      updated[notice.id] = { at: now.getTime(), url: notice.url };
    } catch (error) {
      console.warn("[Optizzz] could not show a notification", error);
    }
  }
  return updated;
}
```

**Verify**: `pnpm vitest run src/features/alerts/notifications.test.ts` → all pass (3 new).

### Step 2: Use it in `background.ts`

Replace the `for` loop and the final `setItem` in `sendNotifications` with:

```ts
const updated = await deliverNotices(notices, sent, now, (notice) =>
  browser.notifications.create(notice.id, {
    type: "basic",
    iconUrl: browser.runtime.getURL("/icons/128.png"),
    title: "Optizzz",
    message: notice.message,
  }),
);
await storage.setItem(SENT_KEY, updated);
```

Add `deliverNotices` to the existing `import { dueNotifications, type SentNotifications } from "./notifications";`.

**Verify**: `pnpm typecheck` → exit 0; `grep -n "notifications.create" src/features/alerts/background.ts` → one
line, inside the `deliverNotices` callback.

### Step 3: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run` → all exit 0.

## Test plan

Three cases in `notifications.test.ts` (Step 1). Use the file's existing `now` constant. Silence the expected
warning in test 2 with `vi.spyOn(console, "warn").mockImplementation(() => undefined)` if the test setup
fails on console output (check `vitest.setup.ts` first).

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `deliverNotices` exported from `notifications.ts` and used in `background.ts`
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `sendNotifications` no longer has the loop shown above.
- `pnpm knip` flags `deliverNotices` as unused (would mean it was not wired in).
- A failing notice must be retried differently (e.g. the browser throws for _every_ notice on Firefox): report
  rather than adding retry logic.

## Maintenance notes

- A notice whose `create` keeps failing is retried every minute, silently (only a console warning). If that
  turns out to be common on a browser, record the failure too, or surface it in the settings panel.
- If the service worker is killed mid-loop, notices shown before the kill are still not saved; acceptable
  since a run is a few notices at most. Saving after each notice would close that gap at the cost of more
  storage writes.
