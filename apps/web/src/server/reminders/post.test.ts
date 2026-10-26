import { describe, expect, it, vi } from "vitest";
import { postReminder } from "./post";

const URL_OK = "https://discord.com/api/webhooks/1/t";

const answering = (status: number) => vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status })));

describe("posting a reminder", () => {
  it("posts the line alone, as « Optizzz », without any mention", async () => {
    const fetcher = answering(204);
    expect(await postReminder(fetcher, URL_OK, "Nouveaux floods")).toEqual({ kind: "sent" });
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(URL_OK);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({
      content: "Nouveaux floods",
      username: "Optizzz",
      allowed_mentions: { parse: [] },
    });
  });

  it.each([401, 404])("suspends the reminders when Discord answers %i: the webhook is gone", async (status) => {
    expect(await postReminder(answering(status), URL_OK, "x")).toEqual({ kind: "suspend", status });
  });

  it.each([400, 403, 429, 500, 503])("drops the reminder on %i, without trying again", async (status) => {
    const fetcher = answering(status);
    expect(await postReminder(fetcher, URL_OK, "x")).toEqual({ kind: "dropped" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("drops it when Discord cannot be reached", async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new TypeError("fetch failed")));
    expect(await postReminder(fetcher, URL_OK, "x")).toEqual({ kind: "dropped" });
  });
});
