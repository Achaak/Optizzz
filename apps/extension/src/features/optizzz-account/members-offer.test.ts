import { describe, expect, it, vi } from "vitest";
import type { AccountStatus } from "./messages";
import { membersOfferCallout, membersOfferFor } from "./members-offer";

const STATUS: AccountStatus = {
  linked: false,
  permitted: false,
  offer: null,
  players: [],
  envois: [],
  notice: null,
};

describe("membersOfferFor", () => {
  it("offers to connect an extension not linked, until « Non merci »", () => {
    expect(membersOfferFor(STATUS, false)).toEqual({ kind: "connect" });
    expect(membersOfferFor(STATUS, true)).toBeNull();
  });

  it("offers to attach the page's Player once linked, whatever was said to connecting", () => {
    const linked = { ...STATUS, linked: true, permitted: true };
    const offer = { origin: "https://s5.fourmizzz.fr", serverName: "S5", pseudo: "Calystene" };
    expect(membersOfferFor({ ...linked, offer }, true)).toEqual({
      kind: "attach",
      pseudo: "Calystene",
      serverName: "S5",
    });
    // Attached, refused (the background then makes no offer), or optizzz.fr taken back: nothing.
    expect(membersOfferFor(linked, false)).toBeNull();
    expect(membersOfferFor({ ...linked, permitted: false, offer }, false)).toBeNull();
  });
});

describe("membersOfferCallout", () => {
  const actions = () => ({ connect: vi.fn(), declineConnect: vi.fn(), attach: vi.fn(), declineAttach: vi.fn() });
  const trustedClick = (button: Element) => {
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "isTrusted", { value: true });
    button.dispatchEvent(event);
  };
  const buttonOf = (box: HTMLElement | null, label: string) => {
    const button = [...(box?.querySelectorAll("button") ?? [])].find((b) => b.textContent === label);
    if (!button) throw new Error(`no « ${label} »`);
    return button;
  };

  it("says what the Espace brings and that nothing leaves without an account", () => {
    const box = membersOfferCallout(document, { kind: "connect" }, actions());
    expect(box?.textContent).toContain("Espace d'alliance sur optizzz.fr");
    expect(box?.textContent).toContain("Sans compte lié, rien ne part de votre navigateur.");
  });

  it("acts on a trusted click only", () => {
    const act = actions();
    const box = membersOfferCallout(document, { kind: "connect" }, act);
    buttonOf(box, "Connecter mon Compte Optizzz").click();
    expect(act.connect).not.toHaveBeenCalled();
    trustedClick(buttonOf(box, "Connecter mon Compte Optizzz"));
    expect(act.connect).toHaveBeenCalledOnce();
  });

  it("names the Player to attach, and « Non merci » declines it", () => {
    const act = actions();
    const box = membersOfferCallout(document, { kind: "attach", pseudo: "Calystene", serverName: "S5" }, act);
    expect(box?.textContent).toContain("Rattacher Calystene (S5) à votre Compte Optizzz ?");
    trustedClick(buttonOf(box, "Non merci"));
    expect(act.declineAttach).toHaveBeenCalledOnce();
    expect(act.attach).not.toHaveBeenCalled();
  });

  it("draws nothing without an offer", () => {
    expect(membersOfferCallout(document, null, actions())).toBeNull();
  });
});
