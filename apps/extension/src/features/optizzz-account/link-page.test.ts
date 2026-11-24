import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { runLinkPage } from "./link-page";
import type { LinkMessage, LinkOffer } from "./messages";

const TOKEN = "T".repeat(43);
const SITE = "https://optizzz.fr";

let sent: LinkMessage[];
let requests: { url: string; init: RequestInit }[];

const OFFER: LinkOffer = { offer: { serverName: "S5", pseudo: "Calystene" }, notice: null };
let offers: LinkOffer[];

const run = (start: boolean, response: () => Promise<Response>, tokenTaken = true) =>
  runLinkPage({
    doc: document,
    origin: SITE,
    browser: "Firefox",
    send: (message) => {
      sent.push(message);
      if (message.action === "offer" || message.action === "attach" || message.action === "decline")
        return Promise.resolve(offers.shift() ?? { offer: null, notice: null });
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
  offers = [];
  document.documentElement.removeAttribute("data-optizzz-link");
  document.body.replaceChildren();
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
      // Then what to offer once linked (nothing here): read from what the extension keeps, no request to the site.
      { type: "optizzz-link", action: "offer" },
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

describe("« Rattacher » on the page, once linked", () => {
  const linked = () => run(true, () => Promise.resolve(Response.json({ token: TOKEN }, { status: 201 })));
  // The box lives in a closed shadow root: the spy keeps it for the test to look inside, as the page's scripts cannot.
  let attachShadow: MockInstance<HTMLElement["attachShadow"]>;

  beforeEach(() => {
    attachShadow = vi.spyOn(HTMLElement.prototype, "attachShadow");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const root = () => attachShadow.mock.results[0]?.value as ShadowRoot | undefined;
  const slot = () => {
    const element = document.createElement("div");
    element.setAttribute("data-optizzz-attach", "");
    document.body.append(element);
    return element;
  };
  const trustedClick = (button: Element) => {
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "isTrusted", { value: true });
    button.dispatchEvent(event);
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("offers the Player of the last game tab, in a closed shadow root of the page's slot", async () => {
    slot();
    offers = [OFFER];
    expect(await linked()).toBe("linked");
    expect(sent.at(-1)).toEqual({ type: "optizzz-link", action: "offer" });
    expect(attachShadow).toHaveBeenCalledWith({ mode: "closed" });
    expect(root()?.textContent).toContain("Rattacher Calystene (S5) à votre Compte Optizzz ?");
  });

  it("attaches on a trusted click only, then says what the site answered", async () => {
    slot();
    offers = [OFFER, { offer: null, notice: { kind: "success", text: "Calystene (S5) est rattaché." } }];
    await linked();
    const button = [...(root()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Rattacher");
    if (!button) throw new Error("no button");
    button.click();
    await settle();
    expect(sent.some((m) => m.action === "attach")).toBe(false);
    trustedClick(button);
    await settle();
    expect(sent.at(-1)).toEqual({ type: "optizzz-link", action: "attach" });
    expect(root()?.querySelector(".box")?.textContent).toContain("Calystene (S5) est rattaché.");
    expect(root()?.querySelector("button")).toBeNull();
  });

  it("forgets the offer on « Non merci »", async () => {
    slot();
    offers = [OFFER, { offer: null, notice: null }];
    await linked();
    const button = [...(root()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === "Non merci");
    if (!button) throw new Error("no button");
    trustedClick(button);
    await settle();
    expect(sent.at(-1)).toEqual({ type: "optizzz-link", action: "decline" });
    expect(root()?.querySelector(".box")).toBeNull();
  });

  it("waits for the page to draw its slot after « linked »", async () => {
    offers = [OFFER];
    const done = linked();
    setTimeout(slot, 20);
    expect(await done).toBe("linked");
    expect(root()?.textContent).toContain("Rattacher Calystene (S5)");
  });

  it("draws nothing without an offer, or when the page never draws its slot", async () => {
    slot();
    await linked();
    expect(attachShadow).not.toHaveBeenCalled();
    document.body.replaceChildren();
    vi.useFakeTimers();
    offers = [OFFER];
    const done = linked();
    await vi.advanceTimersByTimeAsync(2500);
    expect(await done).toBe("linked");
    vi.useRealTimers();
    expect(attachShadow).not.toHaveBeenCalled();
  });
});
