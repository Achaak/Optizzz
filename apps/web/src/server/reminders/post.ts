// Posting one reminder to the reminders' webhook (docs/features/site-discord.md, « Rappels du site »). A plain line,
// never an embed, as « Optizzz », with no mention allowed. Discord saying the webhook is gone (401, 404) suspends the
// space's reminders until an Admin saves an address again; anything else that fails (429, 5xx, unreachable, another
// 4xx) drops this reminder without trying again: the space page shows what it was about.

const TIMEOUT = 10_000;

export type PostResult = { kind: "sent" } | { kind: "suspend"; status: number } | { kind: "dropped" };

export async function postReminder(fetcher: typeof fetch, url: string, content: string): Promise<PostResult> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, username: "Optizzz", allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    return { kind: "dropped" };
  }
  if (response.ok) return { kind: "sent" };
  if (response.status === 401 || response.status === 404) return { kind: "suspend", status: response.status };
  return { kind: "dropped" };
}
