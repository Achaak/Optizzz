# Plan 012: tRPC bounds a request, hides internal errors and logs them

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- "apps/web/src/app/api/trpc" apps/web/src/server/api/trpc.ts apps/web/src/trpc/react.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

The site (`apps/web`, Next.js) exposes its tRPC API at `/api/trpc`, with public procedures that each run
several database queries. Three gaps, on a single small VPS with no rate limit:

1. A batched request may carry any number of calls: tRPC 11 only limits a batch when `maxBatchSize` is given
   (`node_modules/@trpc/server/dist/resolveResponse-*.mjs`: `typeof maxBatchSize === "number"`), and it is not.
2. The body is read and parsed before any procedure checks who calls, with no size limit.
3. In production nothing is logged when a procedure fails, and an unexpected error (for example a Prisma
   unique-constraint failure) reaches the browser with its raw message.

After this plan a batch holds 20 calls at most, a declared body above 4 MB is refused, unexpected errors are
logged on the server and answered with a generic French message.

## Current state

- `apps/web/src/app/api/trpc/[trpc]/route.ts` (whole file):

  ```ts
  import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
  import type { NextRequest } from "next/server";
  import { env } from "~/env";
  import { appRouter } from "~/server/api/root";
  import { createTRPCContext } from "~/server/api/trpc";

  const handler = (req: NextRequest) =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: () => createTRPCContext({ headers: req.headers }),
      onError:
        env.NODE_ENV === "development"
          ? ({ path, error }) => {
              console.error(`tRPC failed on ${path ?? "<no-path>"}: ${error.message}`);
            }
          : undefined,
    });

  export { handler as GET, handler as POST };
  ```

- `apps/web/src/server/api/trpc.ts:11-17`:

  ```ts
  const t = initTRPC.context<typeof createTRPCContext>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: { ...shape.data, zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null },
    }),
  });
  ```

- `apps/web/src/trpc/react.tsx:16` — the browser's client:
  `api.createClient({ links: [httpBatchLink({ transformer: SuperJSON, url: "/api/trpc" })] }),`
  It has no `maxItems`, so it may batch as many calls as a page fires at once.
- Messages thrown on purpose by the site's services are `TRPCError`s with a code other than
  `INTERNAL_SERVER_ERROR` and a French message meant for the person; those must reach the browser unchanged.
- Conventions: English code and comments; text shown to the person in French, « vous ». Tests in `node`
  environment, next to the file, named `*.test.ts`. The `~` alias is `apps/web/src`.

## Commands you will need

| Purpose   | Command                                   | Expected on success              |
| --------- | ----------------------------------------- | -------------------------------- |
| Typecheck | `pnpm typecheck`                          | exit 0                           |
| Lint      | `pnpm lint`                               | exit 0                           |
| Tests     | `pnpm vitest run apps/web/src/server/api` | all pass                         |
| All tests | `pnpm vitest run`                         | all pass                         |
| Dead code | `pnpm knip`                               | no new unused file or dependency |

## Scope

**In scope**:

- `apps/web/src/server/api/limits.ts` (create)
- `apps/web/src/server/api/limits.test.ts` (create)
- `apps/web/src/app/api/trpc/[trpc]/route.ts`
- `apps/web/src/server/api/trpc.ts`
- `apps/web/src/trpc/react.tsx`

**Out of scope**:

- The routers under `apps/web/src/server/api/routers/` and the services they call.
- `/api/extension/*` and `/api/auth/*`: other handlers, other plans.
- Rate limiting per IP: the site keeps no IP address (`deploy/Caddyfile` comment), a product decision.

## Git workflow

- Branch: `fix/trpc-limits`.
- One commit, e.g. `fix(web): bound a tRPC request, and log what fails`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: The limits as pure helpers, tests first

Create `apps/web/src/server/api/limits.test.ts` with:

- `tooLarge`: a `Request` with header `content-length: 4000001` → `true`; `4000000` → `false`; no header →
  `false`; a header that is not a number → `false`.
- `publicMessage`: `("INTERNAL_SERVER_ERROR", "Unique constraint failed on …")` → `GENERIC_ERROR`;
  `("FORBIDDEN", "Vous n'êtes pas membre de cet espace.")` → that same message.

Then create `apps/web/src/server/api/limits.ts`:

```ts
// What one tRPC request may ask of the site (src/app/api/trpc/[trpc]/route.ts): the VPS is small, and the body is
// parsed before any procedure checks who calls.

/** Calls per batched request; the browser's client splits its batches at the same number (src/trpc/react.tsx). */
export const MAX_BATCH = 20;
/** Bytes a request declares at most: the largest real one, an encrypted trust list, is about 1 MB. */
const MAX_BODY = 4_000_000;

export const tooLarge = (request: Request) => Number(request.headers.get("content-length")) > MAX_BODY;

export const GENERIC_ERROR = "Une erreur est survenue. Réessayez dans un instant.";

/** What the browser is told: an unexpected error keeps its details for the server's log. */
export const publicMessage = (code: string, message: string) =>
  code === "INTERNAL_SERVER_ERROR" ? GENERIC_ERROR : message;
```

**Verify**: `pnpm vitest run apps/web/src/server/api/limits.test.ts` → all pass.

### Step 2: Use them in the route

Replace the body of `route.ts` so that it reads:

```ts
const handler = (req: NextRequest) =>
  tooLarge(req)
    ? new Response(null, { status: 413 })
    : fetchRequestHandler({
        endpoint: "/api/trpc",
        req,
        router: appRouter,
        createContext: () => createTRPCContext({ headers: req.headers }),
        maxBatchSize: MAX_BATCH,
        // What the person did wrong is theirs to read; only what the site did not expect is logged.
        onError: ({ path, error }) => {
          if (env.NODE_ENV === "development" || error.code === "INTERNAL_SERVER_ERROR")
            console.error(`tRPC failed on ${path ?? "<no-path>"}: ${error.message}`, error.cause ?? "");
        },
      });
```

Import `MAX_BATCH` and `tooLarge` from `~/server/api/limits`.

**Verify**: `pnpm typecheck` → exit 0. If TypeScript rejects `maxBatchSize`, see STOP conditions.

### Step 3: Hide the message of an unexpected error

In `apps/web/src/server/api/trpc.ts`, add `message: publicMessage(error.code, shape.message),` to the object
returned by `errorFormatter`, after `...shape,`, and import `publicMessage` from `./limits`.

**Verify**: `pnpm typecheck && pnpm lint` → exit 0.

### Step 4: The browser splits its batches at the same number

In `apps/web/src/trpc/react.tsx`, change the link to
`httpBatchLink({ transformer: SuperJSON, url: "/api/trpc", maxItems: MAX_BATCH })` and import `MAX_BATCH` from
`~/server/api/limits` (the module has no server-only import, so a client component may import it).

**Verify**: `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm knip` → exit 0, no new unused file.

## Test plan

`limits.test.ts`, 6 cases (step 1). The route itself has no test: it is glue around the two helpers.

## Done criteria

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` exit 0
- [ ] `grep -n "maxBatchSize" "apps/web/src/app/api/trpc/[trpc]/route.ts"` → one line
- [ ] `grep -n "maxItems" apps/web/src/trpc/react.tsx` → one line
- [ ] Only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `fetchRequestHandler` does not accept `maxBatchSize` in the installed `@trpc/server`
  (`apps/web/package.json` asks `^11.19.0`): report the installed version instead of casting.
- `limits.ts` cannot be imported from `react.tsx` without pulling server code into the browser bundle.
- A test elsewhere expects the raw message of an `INTERNAL_SERVER_ERROR`.

## Maintenance notes

- A request sent without `content-length` (chunked) is not bounded by `tooLarge`. A hard limit belongs in
  Caddy (`request_body { max_size 4MB }` in `deploy/Caddyfile`); it was left out here because it also applies
  to `/api/extension/*`, whose largest body must be checked first.
- Two procedures can still fail with a Prisma unique-constraint error under concurrency (approving one Joueur
  into two spaces at once; two identical Demandes at once). They are now logged and answered with the generic
  message; mapping them to a « rechargez la page » answer is a follow-up.
- If a page ever fires more than 20 queries at once, the client now sends two requests instead of one.
