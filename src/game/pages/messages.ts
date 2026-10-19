// messagerie.php: the conversation headers of the inbox. See docs/research/fourmizzz-pages.md (« messagerie.php »).
import { parseGameInteger } from "@/utils/game-number";
import { fromParisParts, parisParts } from "@/utils/time-format";

/**
 * A « Convoi livré à X » or « Convoi reçu de X » conversation, read in its header. The game may gather several
 * deliveries to the same player in one conversation: the header gives their sum and the time of the last one.
 */
export interface ConvoyMessage {
  /** The conversation's id: the same conversation keeps it as deliveries are added. */
  id: number;
  direction: "sent" | "received";
  player: string;
  food: number;
  materials: number;
  /** When the last delivery of the conversation arrived. */
  at: Date;
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** The Paris day `back` days before `now`'s, at this time. */
function daysBefore(now: Date, back: number, hours: number, minutes: number): Date {
  const today = parisParts(now);
  const day = new Date(Date.UTC(today.year, today.month - 1, today.day - back));
  return fromParisParts({
    year: day.getUTCFullYear(),
    month: day.getUTCMonth() + 1,
    day: day.getUTCDate(),
    hours,
    minutes,
  });
}

/**
 * A message's date as the inbox writes it, Paris time: « 05h48 » (today), « hier 21h03 », « samedi 05h53 » (this
 * past week), « 13 octobre 23h50 » (older, the most recent such day). Null when unreadable.
 */
export function parseMessageDate(text: string, now: Date): Date | null {
  const match = /^(?:(.+?)\s+)?(\d{1,2})h(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const [, day = "", hourText = "", minuteText = ""] = match;
  const hours = Number(hourText);
  const minutes = Number(minuteText);
  const when = day.toLowerCase();
  if (when === "") return daysBefore(now, 0, hours, minutes);
  if (when === "hier") return daysBefore(now, 1, hours, minutes);
  const weekday = WEEKDAYS.indexOf(when);
  if (weekday >= 0) return daysBefore(now, (parisParts(now).weekday - weekday + 7) % 7 || 7, hours, minutes);

  const dated = /^(\d{1,2}) (\p{L}+)(?: (\d{4}))?$/u.exec(when);
  const month = MONTHS.indexOf(dated?.[2] ?? "") + 1;
  if (!dated || month === 0) return null;
  const today = parisParts(now);
  const read = (year: number) => fromParisParts({ year, month, day: Number(dated[1]), hours, minutes });
  if (dated[3]) return read(Number(dated[3]));
  // No year: the latest such day that is not to come.
  const thisYear = read(today.year);
  return thisYear.getTime() > now.getTime() ? read(today.year - 1) : thisYear;
}

/** The amount just before `icon` in the title: « 180 000 <img> ». */
function amountBefore(icon: Element): number {
  const text = icon.previousSibling?.textContent ?? "";
  return parseGameInteger(/([\d\s]+)\s*$/.exec(text.replace(/^.*:/s, ""))?.[1]);
}

/** The convoy conversations listed by the inbox (headers only: nothing is opened), newest first. */
export function readConvoyMessages(doc: Document, now: Date): ConvoyMessage[] {
  const messages: ConvoyMessage[] = [];
  for (const row of doc.querySelectorAll('tr.en_tete_message[data-type="Commerce"]')) {
    const title = row.querySelector("a.intitule_message");
    const match = /^\s*Convoi (livré à|reçu de) (.+?) :/.exec(title?.textContent ?? "");
    const at = parseMessageDate(row.querySelector(".td_objet > span")?.textContent ?? "", now);
    const id = Number(/\d+$/.exec(row.id)?.[0]);
    if (!title || !match?.[2] || !at || !id) continue;
    let food = 0;
    let materials = 0;
    for (const icon of title.querySelectorAll("img")) {
      const alt = icon.getAttribute("alt") ?? "";
      if (alt === "nourriture") food += amountBefore(icon);
      else if (alt === "matériaux") materials += amountBefore(icon);
    }
    messages.push({
      id,
      direction: match[1] === "livré à" ? "sent" : "received",
      player: match[2],
      food,
      materials,
      at,
    });
  }
  return messages;
}
