// On the alliance's Members page (alliance.php?Membres, the members table and the Optizzz alliance views behind their
// hash), once: « Connecter mon Compte Optizzz » for an extension not linked, or « Rattacher Pseudo (S5) » for a
// linked one whose Player is not attached. Both are « Non merci »-able and remembered. Nothing leaves without a click:
// connecting opens the extension's own page, which says what will leave before asking for optizzz.fr.
import { declineConnectOffer, loadConnectOfferDeclined } from "@/data/optizzz-account";
import { isMembersPage } from "@/utils/alliance-views";
import type { Feature } from "../feature";
import { askAccount, type AccountStatus } from "./messages";

export type MembersOffer = { kind: "connect" } | { kind: "attach"; pseudo: string; serverName: string } | null;

/** What to offer: connecting first, then attaching; nothing once declined or done. */
export function membersOfferFor(status: AccountStatus, connectDeclined: boolean): MembersOffer {
  if (!status.linked) return connectDeclined ? null : { kind: "connect" };
  if (status.permitted && status.offer)
    return { kind: "attach", pseudo: status.offer.pseudo, serverName: status.offer.serverName };
  return null;
}

const STYLE = `
.optizzz-members-offer { margin: var(--optizzz-space-4) 0; }
.optizzz-members-offer > * + * { margin-top: var(--optizzz-space-2); }
.optizzz-members-offer .account-actions { display: flex; flex-wrap: wrap; gap: var(--optizzz-space-2); align-items: center; }`;

const paragraph = (doc: Document, text: string, className?: string) => {
  const p = doc.createElement("p");
  p.textContent = text;
  if (className) p.className = className;
  return p;
};

export interface MembersOfferActions {
  connect: () => void;
  declineConnect: () => void;
  attach: () => void;
  declineAttach: () => void;
}

/** The callout, or null when there is nothing to offer. Each button acts on a trusted click only. */
export function membersOfferCallout(doc: Document, offer: MembersOffer, act: MembersOfferActions): HTMLElement | null {
  if (!offer) return null;
  const box = doc.createElement("section");
  box.className = "optizzz-members-offer optizzz-callout";
  box.setAttribute("aria-label", "Compte Optizzz");
  const actions = doc.createElement("div");
  actions.className = "account-actions";
  const button = (label: string, className: string, run: () => void) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = className;
    b.textContent = label;
    b.addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      for (const other of actions.querySelectorAll("button")) other.disabled = true;
      run();
    });
    return b;
  };
  if (offer.kind === "connect") {
    box.append(
      paragraph(
        doc,
        "Votre alliance peut mettre en commun sa Chaîne de TDC, ses convois et ses floods dans un Espace d'alliance sur optizzz.fr, sans copier-coller. Chiffré de bout en bout : même Optizzz ne lit rien.",
      ),
      paragraph(doc, "Facultatif. Sans compte lié, rien ne part de votre navigateur.", "optizzz-note"),
    );
    actions.append(
      button("Connecter mon Compte Optizzz", "optizzz-button-primary", act.connect),
      button("Non merci", "optizzz-button-link", act.declineConnect),
    );
  } else {
    box.append(
      paragraph(doc, `Rattacher ${offer.pseudo} (${offer.serverName}) à votre Compte Optizzz ?`),
      paragraph(
        doc,
        "Il le faut pour rejoindre l'Espace de votre alliance. Le pseudo et son serveur partent vers optizzz.fr ; un Joueur n'appartient qu'à un seul compte.",
        "optizzz-note",
      ),
    );
    actions.append(
      button("Rattacher", "optizzz-button-primary", act.attach),
      button("Non merci", "optizzz-button-link", act.declineAttach),
    );
  }
  box.append(actions);
  return box;
}

/** alliance.php?Membres: the offer above the alliance's content, once. */
export const membersOffer: Feature = {
  id: "members-offer",
  toggle: "optizzz-account",
  matches: (url) => isMembersPage(url),
  async run() {
    const content = document.getElementById("alliance");
    if (!content) return;
    const status = await askAccount({
      type: "optizzz-account",
      action: "status",
      origin: location.origin,
      quiet: true,
    });
    if (!status) return;
    let box: HTMLElement | null = null;
    const after = (next: AccountStatus | null) => {
      box?.remove();
      if (next?.notice) {
        const notice = paragraph(
          document,
          next.notice.text,
          `optizzz-callout optizzz-members-offer ${next.notice.kind === "error" ? "optizzz-callout--warning" : "optizzz-callout--success"}`,
        );
        notice.setAttribute("role", "status");
        content.before(notice);
      }
    };
    box = membersOfferCallout(document, membersOfferFor(status, await loadConnectOfferDeclined()), {
      connect: () => {
        void askAccount({ type: "optizzz-account", action: "connect" }).then(() => box?.remove());
      },
      declineConnect: () => {
        void declineConnectOffer().then(() => box?.remove());
      },
      attach: () => {
        void askAccount({ type: "optizzz-account", action: "attach", origin: location.origin }).then(after);
      },
      declineAttach: () => {
        void askAccount({ type: "optizzz-account", action: "decline", origin: location.origin }).then(() =>
          box?.remove(),
        );
      },
    });
    if (!box) return;
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.append(style);
    content.before(box);
  },
};
