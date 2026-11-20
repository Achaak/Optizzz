// What the site's public route says of a player's hourly analysis, read by the extension's « Analyse » box
// (docs/features/site-analyse.md): written by the site, checked with zod by the extension.
import { z } from "zod";
import { formatPastTime, parisParts } from "../format/time-format";

const weekGrid = z.array(z.array(z.number().int().nonnegative()).length(24)).length(7);

export const floodLineSchema = z.object({
  /** UTC dates of the two exports the move fell between. */
  since: z.string(),
  at: z.string(),
  /** « lost »: the player was flooded; « taken »: the player flooded. */
  direction: z.enum(["lost", "taken"]),
  amount: z.number(),
  /** The other side: the attackers or victims when matched, else the candidates. */
  others: z.array(z.object({ id: z.number().int(), pseudo: z.string(), alliance: z.string().nullable() })),
  /** The alliance the attackers, or else the candidates, share. */
  alliance: z.string().nullable(),
  sureness: z.enum(["sure", "combination", "candidates", "unknown"]),
  /** Between two members of the same alliance: the TDC chain, not a war. Missing before 2026-11-20. */
  inside: z.boolean().default(false),
});

export const playerAnalysisSchema = z.object({
  /** Days the site has read hourly, at most 28. */
  days: z.number().int().nonnegative(),
  quietHours: z.object({ from: z.number().int(), to: z.number().int() }).nullable(),
  grid: z.object({ rises: weekGrid, falls: weekGrid }),
  /** Latest first, 30 days. */
  floods: z.array(floodLineSchema),
});

export type FloodLine = z.infer<typeof floodLineSchema>;
export type PlayerAnalysis = z.infer<typeof playerAnalysisSchema>;

/** « 2 h – 9 h ». */
export const quietHoursText = ({ from, to }: { from: number; to: number }) => `${String(from)} h – ${String(to)} h`;

/** « aujourd'hui entre 13 h et 14 h »: the Paris hours of the two exports a flood fell between. */
export function floodWhen(line: Pick<FloodLine, "since" | "at">, now: Date): string {
  const since = new Date(line.since);
  const at = new Date(line.at);
  const day = formatPastTime(since, now).replace(/\s*\d+ h \d{2}$/, "");
  return `${day} entre ${String(parisParts(since).hours)} h et ${String(parisParts(at).hours)} h`;
}

const withAlliance = (player: FloodLine["others"][number]) =>
  player.alliance ? `${player.pseudo} (${player.alliance})` : player.pseudo;

/** Who probably took the loss, or whom the player took from, as sure as the match is; the TDC chain said. */
export function floodText(line: FloodLine): string {
  const text = otherSide(line);
  return line.inside ? `${text} · dans l'alliance (chaîne de TDC)` : text;
}

function otherSide(line: FloodLine): string {
  const names = line.others.map((player) => player.pseudo);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names.at(-1) ?? ""}` : (names[0] ?? "");
  if (line.direction === "taken") {
    const [victim] = line.others;
    return victim ? `probablement pris à ${withAlliance(victim)}` : "probablement pris";
  }
  switch (line.sureness) {
    case "sure":
      return line.others[0] ? `probablement par ${withAlliance(line.others[0])}` : "coupable inconnu";
    case "combination":
      return `probablement par ${list}`;
    case "candidates":
      // The site keeps 20 candidates at most: up to 20 players of every alliance, which said nothing.
      return line.alliance
        ? `par l'alliance ${line.alliance}, sans savoir qui`
        : `coupable inconnu · ${names.length >= 20 ? "20 joueurs ou plus" : `${String(names.length)} ${names.length > 1 ? "joueurs" : "joueur"}`} à portée ${names.length > 1 ? "ont" : "a"} gagné dans l'heure`;
    case "unknown":
      return "coupable inconnu";
  }
}

/** The tooltip of a flood line: why it is that sure. */
export const SURENESS_TITLES: Record<FloodLine["sureness"], string> = {
  sure: "Sûr : un seul joueur à portée a gagné exactement ce qu'il a perdu.",
  combination: "Combinaison : une seule combinaison de 2 à 4 joueurs à portée fait exactement la somme.",
  candidates: "Candidats : des joueurs à portée ont gagné dans l'heure, aucune somme ne correspond.",
  unknown: "Aucun joueur à portée n'a gagné dans l'heure.",
};

/** Whether a loss has a culprit: matched, or the candidates all of one alliance. */
const hasCulprit = (line: FloodLine) =>
  line.sureness === "sure" ||
  line.sureness === "combination" ||
  (line.sureness === "candidates" && line.alliance !== null);

/** « 91 pertes en 30 jours : 54 dans l'alliance, 3 par d'autres alliances, 34 sans coupable sûr · 14 floods pris ». */
export function floodSummary(lines: readonly FloodLine[], period: string): string {
  if (lines.length === 0) return `Aucun flood probable en ${period}.`;
  const lost = lines.filter((line) => line.direction === "lost");
  const taken = lines.length - lost.length;
  const inside = lost.filter((line) => line.inside).length;
  const others = lost.filter((line) => !line.inside && hasCulprit(line)).length;
  const unknown = lost.length - inside - others;
  const plural = (count: number, one: string, many: string) => `${String(count)} ${count > 1 ? many : one}`;
  const parts = [
    inside > 0 && `${String(inside)} dans l'alliance`,
    others > 0 && `${String(others)} par d'autres alliances`,
    unknown > 0 && `${String(unknown)} sans coupable sûr`,
  ].filter(Boolean);
  const losses = lost.length > 0 ? `${plural(lost.length, "perte", "pertes")} en ${period} : ${parts.join(", ")}` : "";
  const took = taken > 0 ? plural(taken, "flood pris", "floods pris") : "";
  return [losses, lost.length > 0 ? took : took && `${took} en ${period}`].filter(Boolean).join(" · ");
}
