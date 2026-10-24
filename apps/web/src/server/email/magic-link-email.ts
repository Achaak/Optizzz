import { escapeHtml } from "@optizzz/game/format/escape-html";
import type { Email } from "./send-email";

/** The email that carries a magic link (15 minutes, single use). */
export function magicLinkEmail(to: string, url: string): Email {
  const intro = "Pour vous connecter à Optizzz, ouvrez ce lien :";
  const rules = "Il vaut 15 minutes et ne sert qu'une fois.";
  const ignore = "Si vous n'avez rien demandé, ignorez cet e-mail : personne ne pourra se connecter sans ce lien.";
  return {
    to,
    subject: "Votre lien de connexion à Optizzz",
    text: `Bonjour,\n\n${intro}\n${url}\n\n${rules}\n\n${ignore}\n`,
    html: [
      "<p>Bonjour,</p>",
      `<p>${escapeHtml(intro)}</p>`,
      `<p><a href="${escapeHtml(url)}">Se connecter à Optizzz</a></p>`,
      `<p>${escapeHtml(rules)}</p>`,
      `<p>${escapeHtml(ignore)}</p>`,
    ].join("\n"),
  };
}
