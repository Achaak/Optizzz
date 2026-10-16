// Links between the two views of the alliance's figures: the alliance as a whole, and each member.
import { STATS_LINK } from "@/features/alliance-stats/menu";
import { HISTORY_LINK } from "@/features/history/menu";

interface Props {
  current: "alliance" | "members";
  /** Whether the other view is switched on: no link to a view that would show the members table. */
  otherOn: boolean;
}

export function ViewSwitch({ current, otherOn }: Props) {
  if (!otherOn) return null;
  return (
    <nav className="optizzz-segmented view-switch" aria-label="Vues de l'alliance">
      <a href={STATS_LINK} aria-current={current === "alliance" ? "page" : undefined}>
        L'alliance
      </a>
      <a href={HISTORY_LINK} aria-current={current === "members" ? "page" : undefined}>
        Chaque membre
      </a>
    </nav>
  );
}
