// Reading game pages. Selectors are documented in docs/research/fourmizzz-pages.md.

const PSEUDO_CELL = 3;
const HUNTING_FIELD_CELL = 5;

const toInteger = (text: string) => Number(text.replace(/\D/g, ""));

/** Each member's hunting field ("TDC", cm²), read live on alliance.php?Membres, by nickname. */
export function readMembersHuntingField(doc: Document): Map<string, number> {
  const fields = new Map<string, number>();
  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#tabMembresAlliance tr")) {
    const pseudo = row.cells[PSEUDO_CELL]?.querySelector("a")?.textContent.trim();
    const field = row.cells[HUNTING_FIELD_CELL]?.textContent;
    if (pseudo && field) fields.set(pseudo, toInteger(field));
  }
  return fields;
}

export function readLoggedInPseudo(doc: Document): string | null {
  const pseudo = doc.querySelector("#pseudo")?.textContent.trim();
  if (!pseudo) return null;
  return pseudo;
}

/** Attack Speed ("Vitesse d'attaque") research level, read on laboratoire.php. */
export function readAttackSpeedLevel(doc: Document): number | null {
  const title = [...doc.querySelectorAll(".desciption_amelioration h2")].find((h2) =>
    /vitesse d.attaque/i.test(h2.textContent),
  );
  const level = title?.parentElement?.querySelector(".niveau_amelioration")?.textContent;
  return level ? toInteger(level) : null;
}
