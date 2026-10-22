# Plan 001: Escape player and alliance names in the history chart tooltip

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- apps/extension/src/utils/history-chart/chart-option.ts apps/extension/src/utils/map-chart/axes.ts apps/extension/src/utils/html.ts apps/extension/src/features/alliance-map/chart-option.ts apps/extension/src/features/server-map/chart-option.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `9361968`, 2026-10-16

## Why this matters

Optizzz is a browser extension (WXT, MV3) for the game Fourmizzz.fr. Its history charts (ECharts) show
one curve per player or alliance; the curve's name is the player's pseudo or the alliance tag, strings
chosen by other players. ECharts renders the tooltip string returned by a `formatter` as **HTML**. The
history tooltip inserts `param.seriesName` raw, so markup inside a name would be parsed inside the
fourmizzz.fr page the content script runs in. The two map charts already escape the same kind of data
with `escapeHtml`; the history chart was missed. After this plan, every name in that tooltip is escaped,
the helper lives in a neutral place (`apps/extension/src/utils/html.ts`), and a test pins the behaviour.

## Current state

- `apps/extension/src/utils/history-chart/chart-option.ts` — builds the ECharts option of every history chart (used by
  `apps/extension/src/utils/history-chart/HistoryChart.tsx:18`; curves come from `apps/extension/src/features/history/AllianceHistory.tsx`,
  `apps/extension/src/features/history/ProfileHistory.tsx`, `apps/extension/src/features/alliance-stats/AllianceStats.tsx`,
  `apps/extension/src/features/alliance-stats/AllianceBox.tsx`, where `name` is a pseudo or an alliance tag).
  Lines 37–42 today:

  ```ts
  tooltip: {
    trigger: "item",
    formatter: (param: TooltipParam) =>
      `${formatDateTime(new Date(param.data.value[0]))}${param.data.live ? " · en direct" : ""}<br>` +
      `${param.marker}${param.seriesName} : <b>${formatNumber(param.data.value[1])}</b>`,
  },
  ```

  `param.marker` is ECharts' own coloured-dot HTML: it must stay unescaped.

- `apps/extension/src/utils/map-chart/axes.ts:154` — the existing escaper, oddly filed with map axes:

  ```ts
  export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  ```

  Imported by `apps/extension/src/features/alliance-map/chart-option.ts:11` and `apps/extension/src/features/server-map/chart-option.ts:6`
  (both import it in a list together with other `axes` symbols).

- `apps/extension/src/utils/html.ts` — DOM-building helpers (`htmlElement`, `svgElement`), with header comment
  "Only for markup written in our code: never pass game or player data in". Tests in `apps/extension/src/utils/html.test.ts`
  (vitest, `describe`/`it`/`expect`, happy-dom).

- Conventions (from `CLAUDE.md`): code, identifiers, comments and test names in **English**; text shown to
  the player in French. Imports use the `@/` alias for `apps/extension/src/`. Tests sit next to the file as `*.test.ts`.

## Commands you will need

| Purpose   | Command                                                                                        | Expected on success                            |
| --------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Install   | `pnpm install`                                                                                 | exit 0                                         |
| Typecheck | `pnpm typecheck`                                                                               | exit 0, no errors                              |
| One test  | `pnpm vitest run apps/extension/src/utils/history-chart apps/extension/src/utils/html.test.ts` | all pass                                       |
| All tests | `pnpm vitest run`                                                                              | all pass                                       |
| Lint      | `pnpm lint`                                                                                    | 0 errors                                       |
| Dead code | `pnpm knip`                                                                                    | no new "Unused exports" entry for `escapeHtml` |

## Scope

**In scope** (the only files you should modify):

- `apps/extension/src/utils/html.ts` (add `escapeHtml`)
- `apps/extension/src/utils/html.test.ts` (add tests)
- `apps/extension/src/utils/map-chart/axes.ts` (remove `escapeHtml`)
- `apps/extension/src/features/alliance-map/chart-option.ts`, `apps/extension/src/features/server-map/chart-option.ts` (import path only)
- `apps/extension/src/utils/history-chart/chart-option.ts` (escape the name)
- `apps/extension/src/utils/history-chart/chart-option.test.ts` (create)

**Out of scope**:

- Label `formatter`s that are plain strings (`formatter: nameOf(m)` in the map options): ECharts draws
  those on canvas, not as HTML.
- Any change to the tooltip's text or look.

## Git workflow

- Branch: `fix/escape-history-tooltip`.
- Conventional Commits, as in `git log`: e.g. `fix(history): escape names in the chart tooltip`.
- The Husky pre-commit hook runs lint-staged, `typecheck` and the tests: never use `--no-verify`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move `escapeHtml` to `apps/extension/src/utils/html.ts`

Cut the `escapeHtml` line from `apps/extension/src/utils/map-chart/axes.ts:154` and add it to `apps/extension/src/utils/html.ts` with a
doc comment, e.g. `/** Text safe to put inside HTML markup (ECharts tooltips): player and game data go through it. */`.
In the two map `chart-option.ts` files, remove `escapeHtml` from the `@/utils/map-chart/axes` import list and
add `import { escapeHtml } from "@/utils/html";`.

**Verify**: `grep -rn "escapeHtml" src` → only `apps/extension/src/utils/html.ts` defines it; the two map options import it
from `@/utils/html`. `pnpm typecheck` → exit 0.

### Step 2: Test `escapeHtml`

In `apps/extension/src/utils/html.test.ts`, add `describe("escapeHtml", …)` checking that `& < > " '` are each replaced by a
numeric entity and that plain text (including accents like `é`) is unchanged.

**Verify**: `pnpm vitest run apps/extension/src/utils/html.test.ts` → all pass.

### Step 3: Escape the series name in the history tooltip

In `apps/extension/src/utils/history-chart/chart-option.ts`, import `escapeHtml` from `@/utils/html` and replace
`${param.seriesName}` by `${escapeHtml(param.seriesName)}`. Leave `param.marker` as it is.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Test the tooltip

Create `apps/extension/src/utils/history-chart/chart-option.test.ts`. Build an option with
`buildHistoryOption([{ name: "<b>x</b>", points: [{ time: 0, value: 1, live: false }] }], false)`, take
`(option.tooltip as { formatter: (p: unknown) => string }).formatter`, call it with
`{ seriesName: "<b>x</b>", marker: "<span></span>", data: { value: [0, 1234], live: false } }`, and assert:

- the result contains `&#60;b&#62;x&#60;/b&#62;` and does not contain `<b>x</b>`;
- the marker `<span></span>` is still present unescaped;
- the number is formatted (`1 234` as written by `formatNumber`; copy the exact string the function returns).

Model the file on `apps/extension/src/features/server-map/chart-option.test.ts` (plain vitest, no rendering).

**Verify**: `pnpm vitest run apps/extension/src/utils/history-chart` → the new tests pass.

### Step 5: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm knip` → all exit 0, knip lists no new
unused export.

## Test plan

- `apps/extension/src/utils/html.test.ts`: escaping of each special character; plain text untouched.
- `apps/extension/src/utils/history-chart/chart-option.test.ts` (new): a name containing markup comes out escaped, the
  marker stays HTML.

## Done criteria

- [ ] `grep -n "escapeHtml" apps/extension/src/utils/map-chart/axes.ts` returns nothing
- [ ] `grep -n "escapeHtml(param.seriesName)" apps/extension/src/utils/history-chart/chart-option.ts` returns one line
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`, `pnpm knip` exit 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `chart-option.ts` no longer builds the tooltip with a string formatter (e.g. it moved to `renderMode: "richText"`): report, the fix may already be in.
- Another `formatter` returning an HTML string with player data turns up outside the two map options and the history chart: report it rather than widening scope.
- A test needs a real ECharts instance to get at the formatter.

## Maintenance notes

- Rule for reviewers: every ECharts `tooltip.formatter` that returns a string must pass game or player data
  through `escapeHtml`. Label formatters (canvas) do not need it.
- `apps/extension/src/utils/html.ts`'s header comment says not to pass player data to `htmlElement`; `escapeHtml` is the
  sanctioned way for HTML strings handed to a library.
