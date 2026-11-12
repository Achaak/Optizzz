# Plan 017: A deployment that cannot reach its database fails, and going back is written down

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- deploy/compose.yml .github/workflows/deploy.yml docs/adr/0009-vps-scaleway.md apps/web/src/app/api`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The site is deployed by GitHub Actions onto one VPS: `deploy/deploy.sh` starts the new container and waits for
Docker to call it healthy. The health check fetches `/robots.txt`, a static file that answers even when the
site cannot talk to its database (a wrong password for the site's database role, a missing grant, a migration
that did not apply). The workflow then stops: nothing ever requests the real site through HTTPS. A deployment
that breaks every page with data can therefore end green. And nowhere is it written how to go back to the
previous version. After this plan the health check reads both database schemas the site uses, the workflow
ends by asking the public address, and the way back is documented.

## Current state

- `deploy/compose.yml:44-48`, service `web`:

  ```yaml
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/robots.txt"]
    interval: 10s
    retries: 6
    start_period: 10s
  ```

- `.github/workflows/deploy.yml`, last step of the last job (`deploy`):

  ```yaml
  - name: Copy deploy/ and run deploy.sh
    env:
      VPS: optizzz@${{ secrets.VPS_HOST }}
    run: |
      scp -r deploy/compose.yml deploy/Caddyfile deploy/deploy.sh deploy/ingest.sh deploy/backup.sh \
        deploy/postgres deploy/systemd "$VPS:/opt/optizzz/"
      ssh "$VPS" /opt/optizzz/deploy.sh "${{ github.sha }}"
  ```

- `apps/web/src/server/db.ts` exports `db`, the Prisma client. The site connects with the role `optizzz_app`,
  which reads the schema `public` (the game servers' data, e.g. the model `ExportRead`) and reads and writes the
  schema `accounts` (e.g. the model `User`). Its rights are set at each deployment by `deploy/postgres/grants.sql`.
- An existing route handler, as a pattern — `apps/web/src/app/api/revalidate/route.ts`:

  ```ts
  // Called by the cron once the exports are stored: every page is rebuilt at its next visit.
  import { revalidatePath } from "next/cache";
  import { env } from "~/env";

  export function POST(request: Request) {
    if (request.headers.get("authorization") !== `Bearer ${env.REVALIDATE_SECRET}`)
      return new Response(null, { status: 401 });
    revalidatePath("/", "layout");
    return Response.json({ revalidated: true });
  }
  ```

- `deploy/deploy.sh` takes the version as its argument (`./deploy.sh <tag>`, the commit's full SHA): it pulls
  `ghcr.io/achaak/optizzz-{web,tools}:<tag>`, applies the migrations (`prisma migrate deploy`, which only goes
  forward), sets the rights, then starts the site. Images of earlier commits stay in the registry.
- `docs/adr/0009-vps-scaleway.md` ends with a section `## Conséquences`, a bullet list in French; its last
  bullet is: `- Lancer le cron à la main sur un serveur : \`ssh optizzz@<VPS> /opt/optizzz/ingest.sh --server s5\`.`
- Conventions: code and comments in English; documentation under `docs/` in French. Tests next to the file,
  `*.test.ts`, vitest in `node`. The `~` alias is `apps/web/src`.

## Commands you will need

| Purpose   | Command                               | Expected on success |
| --------- | ------------------------------------- | ------------------- |
| Typecheck | `pnpm typecheck`                      | exit 0              |
| Lint      | `pnpm lint`                           | exit 0              |
| Tests     | `pnpm vitest run apps/web/src/server` | all pass            |
| Format    | `pnpm format:check`                   | exit 0              |
| Dead code | `pnpm knip`                           | no new unused file  |

## Scope

**In scope**:

- `apps/web/src/server/health.ts` (create)
- `apps/web/src/server/health.test.ts` (create)
- `apps/web/src/app/api/health/route.ts` (create)
- `deploy/compose.yml` (the `web` health check only)
- `.github/workflows/deploy.yml` (one step added at the end)
- `docs/adr/0009-vps-scaleway.md` (bullets added to « Conséquences »)

**Out of scope**:

- `deploy/deploy.sh`: its order (migrations, rights, site) stays.
- An automatic rollback: going back stays a human decision.
- `.github/workflows/ci.yml`.

## Git workflow

- Branch: `fix/health-check-and-rollback`.
- One commit, e.g. `fix(deploy): the health check reads the database, and the deployment asks the site`.
- Never `--no-verify`. Do not push: a push to `main` that touches these paths deploys.

## Steps

### Step 1: The check as a function, test first

Create `apps/web/src/server/health.test.ts`:

- "answers 200 when every read works": `await health([() => Promise.resolve(1), () => Promise.resolve(null)])`
  → status `200`.
- "answers 503, without details, when a read fails": `await health([() => Promise.reject(new Error("password authentication failed"))])`
  → status `503`, and `await response.text()` does not contain `password`.

Create `apps/web/src/server/health.ts`:

```ts
// What Docker and the deployment ask to know the site works (deploy/compose.yml, .github/workflows/deploy.yml):
// a page that answers is not enough, the site must read its database.

/** 200 when every read works, 503 otherwise; never why, the address is public. */
export async function health(reads: readonly (() => Promise<unknown>)[]): Promise<Response> {
  try {
    await Promise.all(reads.map((read) => read()));
    return new Response("ok", { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Health check failed", error);
    return new Response("unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }
}
```

**Verify**: `pnpm vitest run apps/web/src/server/health.test.ts` → 2 pass.

### Step 2: The route

Create `apps/web/src/app/api/health/route.ts`:

```ts
// One row of each schema the site reads with its own role: the servers' data (public) and the accounts.
import { db } from "~/server/db";
import { health } from "~/server/health";

export const dynamic = "force-dynamic";

export const GET = () =>
  health([
    () => db.exportRead.findFirst({ select: { server: true } }),
    () => db.user.findFirst({ select: { id: true } }),
  ]);
```

**Verify**: `pnpm typecheck && pnpm lint` → exit 0. If `db.user` or `db.exportRead` does not exist on the
client, see STOP conditions.

### Step 3: Docker asks the new route

In `deploy/compose.yml`, change the `web` health check's `test` to
`["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]`. Change nothing else.

**Verify**: `grep -n "robots.txt" deploy/compose.yml` → no match.
`docker compose -f deploy/compose.yml config -q` → exit 0 if Docker is installed (it needs the variables of
`deploy/.env.example`; skip it, and say so, if it only fails on missing variables).

### Step 4: The workflow ends by asking the site

In `.github/workflows/deploy.yml`, add as the last step of the `deploy` job, with the same indentation as the
step before it:

```yaml
# Through Caddy and HTTPS, as a visitor: deploy.sh only knows the container answers on the VPS itself.
- name: The site answers, its database included
  run: curl --fail --silent --show-error --retry 5 --retry-delay 5 --retry-all-errors https://optizzz.fr/api/health
```

**Verify**: `pnpm format:check` → exit 0 (Prettier checks the YAML).

### Step 5: Write down the way back

In `docs/adr/0009-vps-scaleway.md`, append to the list under `## Conséquences`:

```markdown
- Un déploiement se termine par `https://optizzz.fr/api/health`, qui lit une ligne des données des serveurs et une des comptes : la page répond « ok » ou 503. Docker s'en sert aussi pour dire le site prêt.
- Revenir à la version précédente : `ssh optizzz@<VPS> /opt/optizzz/deploy.sh <SHA du commit précédent>` (son image est restée dans le registre). Les migrations, elles, ne reviennent pas en arrière : une migration doit rester compatible avec le code de la version d'avant (ajouter une colonne dans un déploiement, cesser de s'en passer dans le suivant), sinon le retour demande de restaurer une sauvegarde (`deploy/backup.sh`).
```

**Verify**: `pnpm format:check` → exit 0.

### Step 6: Full gate

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm knip` → exit 0, no new unused file.

## Test plan

Two tests in `apps/web/src/server/health.test.ts` (step 1). The route, the compose file and the workflow are
first exercised by the next deployment.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`, `pnpm format:check` exit 0
- [ ] `grep -n "api/health" deploy/compose.yml .github/workflows/deploy.yml` → one line in each file
- [ ] `docs/adr/0009-vps-scaleway.md` has the two new bullets
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The Prisma client has no `user` or `exportRead` model under those names (check
  `apps/web/prisma/schema.prisma`: `model User`, `model ExportRead`).
- `pnpm --filter @optizzz/web build`, if you run it, tries to prerender `/api/health` at build time and fails:
  report it rather than removing `dynamic`.
- The `deploy` job of the workflow no longer ends with the step shown above.

## Maintenance notes

- The first deployment that carries this change is itself checked by the new health check: if it fails,
  `docker compose logs web` on the VPS shows « Health check failed » with the cause.
- `/api/health` is public and says only « ok » or « unavailable ». Do not add versions, counts or timings to it.
- If the site gains a dependency it cannot work without (a queue, a second database), add its read to the
  list in the route.
