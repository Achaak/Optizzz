// Reine.php, read by the laying planner and the research advice (docs/research/fourmizzz-pages.md, « Reine.php »).
import { UNITS } from "@/game/army/units";

/** The player's laying speed (bonuses included), as the page's script applies it: `temps_ponte_base*0.1094…`. */
export function readLayingSpeed(doc: Document): number | null {
  for (const script of doc.querySelectorAll("script:not([src])")) {
    const match = /temps_ponte_base\s*\*\s*(\d+(?:\.\d+)?)/.exec(script.textContent);
    if (match) return Number(match[1]);
  }
  return null;
}

/**
 * Keys of the units the player can lay. A locked unit still has a form (`typeUnite`), but without the quantity field
 * and with its missing requirement marked `verificationNonOK` (S5, 2026-10-16).
 */
export function readLayableUnits(doc: Document): string[] {
  const types = new Set(
    [...doc.querySelectorAll<HTMLInputElement>('form input[name="typeUnite"]')]
      .filter((input) => {
        const row = input.closest(".ligneAmelioration") ?? input.form;
        return (
          !!input.form?.querySelector('input[id^="input_cout_nombre"]') && !row?.querySelector(".verificationNonOK")
        );
      })
      .map((input) => input.value),
  );
  return UNITS.filter((unit) => types.has(`unite${String(unit.field)}`)).map((unit) => unit.key);
}
