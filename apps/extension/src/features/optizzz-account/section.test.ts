import { describe, expect, it } from "vitest";
import type { AccountAction, AccountStatus } from "./messages";
import { buildAccountSection } from "./section";

const S5 = "https://s5.fourmizzz.fr";
const unlinked: AccountStatus = { linked: false, permitted: false, offer: null, players: [], notice: null };
const linked: AccountStatus = {
  linked: true,
  permitted: true,
  offer: { origin: S5, serverName: "S5", pseudo: "Calystene" },
  players: [],
  notice: null,
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(answers: (action: AccountAction) => AccountStatus | null, origin: string | null = S5) {
  const asked: AccountAction[] = [];
  const section = buildAccountSection(document, {
    origin,
    ask: (action) => {
      asked.push(action);
      return Promise.resolve(answers(action));
    },
  });
  document.body.replaceChildren(section);
  return { section, asked };
}

const buttonNamed = (section: HTMLElement, name: string) =>
  [...section.querySelectorAll("button")].find((button) => button.textContent === name);

/** A person's click: happy-dom marks dispatched events untrusted, as a page's script's would be. */
function personClick(button: HTMLButtonElement | undefined) {
  const event = new MouseEvent("click", { bubbles: true });
  Object.defineProperty(event, "isTrusted", { value: true });
  button?.dispatchEvent(event);
}

describe("the « Compte Optizzz » block", () => {
  it("asks the background for the state of the page's server", async () => {
    const { asked } = mount(() => unlinked);
    await settle();
    expect(asked).toEqual([{ type: "optizzz-account", action: "status", origin: S5 }]);
  });

  it("offers to connect when not linked", async () => {
    const { section, asked } = mount(() => unlinked);
    await settle();
    expect(section.textContent).toContain("Sans compte lié, l'extension n'envoie rien.");
    personClick(buttonNamed(section, "Connecter mon Compte Optizzz"));
    expect(asked.at(-1)).toEqual({ type: "optizzz-account", action: "connect" });
  });

  it("offers « Rattacher Pseudo (S5) », and attaches on a click", async () => {
    const { section, asked } = mount((action) =>
      action.action === "attach"
        ? {
            ...linked,
            offer: null,
            players: [{ server: "s5", pseudo: "Calystene" }],
            notice: { kind: "success", text: "Calystene (S5) est rattaché à votre Compte Optizzz." },
          }
        : linked,
    );
    await settle();
    expect(section.textContent).toContain("Rattacher Calystene (S5) à votre Compte Optizzz ?");
    personClick(buttonNamed(section, "Rattacher"));
    await settle();
    expect(asked.at(-1)).toEqual({ type: "optizzz-account", action: "attach", origin: S5 });
    expect(section.textContent).toContain("Joueurs rattachés : Calystene (S5).");
    expect(section.querySelector('[role="status"]')?.textContent).toBe(
      "Calystene (S5) est rattaché à votre Compte Optizzz.",
    );
    expect(buttonNamed(section, "Rattacher")).toBeUndefined();
  });

  it("ignores a click a page's script would make", async () => {
    const { section, asked } = mount(() => linked);
    await settle();
    buttonNamed(section, "Rattacher")?.click();
    await settle();
    expect(asked).toHaveLength(1);
  });

  it("« Non merci » and « Déconnecter » go to the background", async () => {
    const { section, asked } = mount(() => linked);
    await settle();
    personClick(buttonNamed(section, "Non merci"));
    await settle();
    expect(asked.at(-1)).toEqual({ type: "optizzz-account", action: "decline", origin: S5 });
    personClick(buttonNamed(section, "Déconnecter"));
    await settle();
    expect(asked.at(-1)).toEqual({ type: "optizzz-account", action: "disconnect" });
  });

  it("says when optizzz.fr was taken back from a linked extension", async () => {
    const { section } = mount(() => ({ ...linked, permitted: false, offer: null }));
    await settle();
    expect(section.textContent).toContain("L'accès à optizzz.fr a été retiré");
    expect(buttonNamed(section, "Connecter mon Compte Optizzz")).toBeDefined();
  });
});
