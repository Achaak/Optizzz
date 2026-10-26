import { describe, expect, it } from "vitest";
import type { AccountAction, AccountStatus } from "./messages";
import { buildAccountSection } from "./section";

const S5 = "https://s5.fourmizzz.fr";
const unlinked: AccountStatus = { linked: false, permitted: false, offer: null, players: [], envois: [], notice: null };
const linked: AccountStatus = {
  linked: true,
  permitted: true,
  offer: { origin: S5, serverName: "S5", pseudo: "Calystene" },
  players: [],
  envois: [],
  notice: null,
};

const choices = {
  production: false,
  convoys: false,
  floods: false,
  hunts: false,
  army: "none",
  levels: false,
} as const;
const sending: AccountStatus = {
  ...linked,
  offer: null,
  players: [{ server: "s5", pseudo: "Calystene" }],
  envois: [{ server: "s5", pseudo: "Calystene", choices, spaceName: null, problem: null, lastSentAt: null }],
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

  it("lists the six categories of each Joueur, all unticked, and only « Convois » and « Floods » can be ticked today", async () => {
    const { section } = mount(() => sending);
    await settle();
    expect(section.querySelector("legend")?.textContent).toBe("Envois de Calystene (S5)");
    const boxes = [...section.querySelectorAll<HTMLInputElement>("input[data-category]")];
    expect(boxes.map((b) => [b.dataset.category, b.checked, b.disabled])).toEqual([
      ["production", false, true],
      ["convoys", false, false],
      ["floods", false, false],
      ["hunts", false, true],
      ["army", false, true],
      ["levels", false, true],
    ]);
    expect(section.textContent).toContain("Vos convois envoyés, reçus et en route.");
    expect(section.textContent).toContain("l'armée, pour les Admins seuls");
  });

  it("ticks « Floods » apart from « Convois »", async () => {
    const { section, asked } = mount(() => sending);
    await settle();
    const box = section.querySelector<HTMLInputElement>('input[data-category="floods"]');
    if (!box) throw new Error("no box");
    box.checked = true;
    const event = new Event("change");
    Object.defineProperty(event, "isTrusted", { value: true });
    box.dispatchEvent(event);
    await settle();
    expect(asked.at(-1)).toMatchObject({ action: "choose", choices: { ...choices, floods: true } });
  });

  it("ticks « Convois » on a person's click only, and says what stops the Envoi", async () => {
    const answer: AccountStatus = {
      ...sending,
      envois: [
        {
          server: "s5",
          pseudo: "Calystene",
          choices: { ...choices, convoys: true },
          spaceName: "ABC sur S5",
          problem: "Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi.",
          lastSentAt: null,
        },
      ],
    };
    const { section, asked } = mount((action) => (action.action === "choose" ? answer : sending));
    await settle();
    const box = section.querySelector<HTMLInputElement>('input[data-category="convoys"]');
    if (!box) throw new Error("no box");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    await settle();
    expect(asked).toHaveLength(1);
    box.checked = true;
    const event = new Event("change");
    Object.defineProperty(event, "isTrusted", { value: true });
    box.dispatchEvent(event);
    await settle();
    expect(asked.at(-1)).toEqual({
      type: "optizzz-account",
      action: "choose",
      server: "s5",
      pseudo: "Calystene",
      choices: { ...choices, convoys: true },
    });
    expect(section.querySelector('[role="status"]')?.textContent).toBe(
      "Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi.",
    );
  });

  it("says when optizzz.fr was taken back from a linked extension", async () => {
    const { section } = mount(() => ({ ...linked, permitted: false, offer: null }));
    await settle();
    expect(section.textContent).toContain("L'accès à optizzz.fr a été retiré");
    expect(buttonNamed(section, "Connecter mon Compte Optizzz")).toBeDefined();
  });
});
