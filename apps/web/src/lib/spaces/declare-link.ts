// The link to the page « Déclarer » (ADR 0010, docs/features/site-declarer.md): an Admin copies it, or posts it from
// their browser on the announcements' webhook, which they open with the Clé d'alliance. The site never posts it and
// never reads that webhook. The link holds nothing of the alliance: the page asks for the Clé d'alliance.

const TIMEOUT = 10_000;

export const declareUrl = (origin: string, spaceId: string): string => `${origin}/spaces/${spaceId}/declarer`;

/** One plain line; the link between angle brackets, so that Discord shows no preview. */
export const declareLinkMessage = (url: string): string =>
  `Déclarez un flood, un convoi ou une chasse sur Optizzz : <${url}>`;

export type PostLinkResult = { kind: "sent" } | { kind: "refused"; status: number } | { kind: "unreachable" };

export async function postDeclareLink(fetcher: typeof fetch, webhook: string, url: string): Promise<PostLinkResult> {
  let response: Response;
  try {
    response = await fetcher(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: declareLinkMessage(url), allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    return { kind: "unreachable" };
  }
  return response.ok ? { kind: "sent" } : { kind: "refused", status: response.status };
}
