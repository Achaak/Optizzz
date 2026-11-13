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
