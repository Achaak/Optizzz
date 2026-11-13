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
