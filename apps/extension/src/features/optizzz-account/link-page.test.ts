import { beforeEach, describe, expect, it } from "vitest";
import { runLinkPage } from "./link-page";
import type { LinkMessage } from "./messages";

const TOKEN = "T".repeat(43);
const SITE = "https://optizzz.fr";

let sent: LinkMessage[];
let requests: { url: string; init: RequestInit }[];

const run = (start: boolean, response: () => Promise<Response>, tokenTaken = true) =>
  runLinkPage({
    doc: document,
    origin: SITE,
    browser: "Firefox",
    send: (message) => {
      sent.push(message);
      return Promise.resolve({ ok: message.action === "start" ? start : tokenTaken });
    },
    fetch: (url, init) => {
      requests.push({ url, init });
      return response();
    },
  });

beforeEach(() => {
  sent = [];
  requests = [];
  document.documentElement.removeAttribute("data-optizzz-link");
});

describe("the link script on « Connecter l'extension »", () => {
  it("asks the site for a token, same-origin, and hands it to the background, never to the page", async () => {
    const state = await run(true, () => Promise.resolve(Response.json({ token: TOKEN }, { status: 201 })));
    expect(state).toBe("linked");
    expect(requests).toEqual([
      {
        url: `${SITE}/api/extension/link`,
        init: {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ browser: "Firefox" }),
        },
      },
    ]);
    expect(sent).toEqual([
      { type: "optizzz-link", action: "start" },
      { type: "optizzz-link", action: "token", token: TOKEN },
    ]);
    expect(document.documentElement.getAttribute("data-optizzz-link")).toBe("linked");
    expect(document.documentElement.outerHTML).not.toContain(TOKEN);
  });

  it("does nothing but say so when the extension did not ask to be linked", async () => {
    expect(await run(false, () => Promise.reject(new Error("never called")))).toBe("not-requested");
    expect(requests).toEqual([]);
    expect(document.documentElement.getAttribute("data-optizzz-link")).toBe("not-requested");
  });

  it("says it failed when the site refuses, cannot be reached, or the background refuses the token", async () => {
    expect(await run(true, () => Promise.resolve(Response.json({ error: "signed-out" }, { status: 401 })))).toBe(
      "failed",
    );
    expect(await run(true, () => Promise.reject(new TypeError("offline")))).toBe("failed");
    expect(await run(true, () => Promise.resolve(Response.json({ token: TOKEN })), false)).toBe("failed");
  });
});
