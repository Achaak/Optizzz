// « Donner l'accès » asks the Admin's linked extension for its last list of the game's Members page
// (@optizzz/game/site-links/space-bridge.ts): the pseudo must be in a list of the space's alliance, read less than 24
// hours ago (docs/features/site-comptes-espaces.md, « Approuver »). Pure, so the rule is tested apart from the page.
import type { MembersAnswer } from "@optizzz/game/site-links/space-bridge";

const MEMBERS_LIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type MembersCheck =
  { ok: true } | { ok: false; reason: "no-extension" | "unlinked" | "no-list" | "other-alliance" | "stale" | "absent" };

export function checkMembersList(
  answer: MembersAnswer | null,
  { tag, pseudo, now }: { tag: string; pseudo: string; now: Date },
): MembersCheck {
  if (!answer) return { ok: false, reason: "no-extension" };
  if (answer.status === "unlinked") return { ok: false, reason: "unlinked" };
  const list = answer.members;
  if (!list) return { ok: false, reason: "no-list" };
  if (list.tag !== null && list.tag.toLowerCase() !== tag.toLowerCase()) return { ok: false, reason: "other-alliance" };
  const age = now.getTime() - list.readAt;
  if (age < 0 || age > MEMBERS_LIST_MAX_AGE_MS) return { ok: false, reason: "stale" };
  return list.pseudos.includes(pseudo) ? { ok: true } : { ok: false, reason: "absent" };
}

const OPEN_MEMBERS = "Ouvrez la page Membres de votre alliance dans le jeu, puis revenez.";

/** What to tell the Admin, in French. */
export function membersCheckMessage(check: MembersCheck, { pseudo, tag }: { pseudo: string; tag: string }): string {
  if (check.ok) return "";
  switch (check.reason) {
    case "no-extension":
      return "L'extension Optizzz ne répond pas sur ce navigateur. Il faut l'extension, liée à votre Compte Optizzz, pour donner l'accès.";
    case "unlinked":
      return "L'extension Optizzz de ce navigateur n'est pas liée à votre Compte Optizzz : connectez-la depuis ses paramètres, puis revenez.";
    case "no-list":
      return OPEN_MEMBERS;
    case "other-alliance":
      return `La dernière page Membres lue n'est pas celle de ${tag}. ${OPEN_MEMBERS}`;
    case "stale":
      return `La dernière page Membres lue date de plus de 24 heures. ${OPEN_MEMBERS}`;
    case "absent":
      return `${pseudo} n'est pas sur la dernière page Membres de ${tag} lue par votre extension. S'il vient d'entrer dans l'alliance, ${OPEN_MEMBERS.charAt(0).toLowerCase()}${OPEN_MEMBERS.slice(1)}`;
  }
}
