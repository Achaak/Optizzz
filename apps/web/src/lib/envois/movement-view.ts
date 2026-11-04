// The « Mouvements » tab's choice, kept in the address so that a link opens it the same
// (docs/features/site-mouvements.md): `?onglet=mouvements&jour=2026-11-02&membre=Zeph&types=floods,convois`. What it
// does not know is left at its default.
import type { MovementKind } from "./movements";

export interface MovementView {
  /** « 2026-11-02 », a day of Paris; null for today. */
  day: string | null;
  /** A member's pseudo, as the space writes it. */
  member: string | null;
  kinds: MovementKind[];
}

/** The value of `onglet` that opens the « Mouvements » tab. */
export const MOVEMENTS_TAB = "mouvements";

/** Each kind as the address writes it, in the tab's order. */
const KIND_WORDS: Record<MovementKind, string> = { flood: "floods", convoy: "convois", hunt: "chasses" };
const KINDS = Object.keys(KIND_WORDS) as MovementKind[];

export const DEFAULT_MOVEMENT_VIEW: MovementView = { day: null, member: null, kinds: KINDS };

export function readMovementView(
  params: { get: (name: string) => string | null },
  members: readonly string[],
): MovementView {
  const day = params.get("jour");
  const wanted = params.get("membre")?.toLowerCase();
  const words = params.get("types")?.split(",") ?? [];
  const kinds = KINDS.filter((kind) => words.includes(KIND_WORDS[kind]));
  return {
    day: day !== null && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    member: members.find((m) => m.toLowerCase() === wanted) ?? null,
    kinds: kinds.length > 0 ? kinds : KINDS,
  };
}

export function movementViewSearch(view: MovementView): string {
  const params = new URLSearchParams({ onglet: MOVEMENTS_TAB });
  if (view.day !== null) params.set("jour", view.day);
  if (view.member !== null) params.set("membre", view.member);
  const kinds = KINDS.filter((kind) => view.kinds.includes(kind));
  // The words never need escaping: the comma stays readable.
  const types = kinds.length < KINDS.length ? `&types=${kinds.map((kind) => KIND_WORDS[kind]).join(",")}` : "";
  return params.toString() + types;
}
