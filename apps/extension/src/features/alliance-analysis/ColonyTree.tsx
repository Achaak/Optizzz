import { formatAmount } from "@optizzz/game/format/number-format";
import type { ColonyNode } from "@optizzz/game/analysis/colonies";

/** A master and its colonies, one level a step to the right. */
export function ColonyTree({ node }: { node: ColonyNode }) {
  return (
    <ul className="colony-tree">
      <li>
        {node.pseudo} <span className="optizzz-muted">({node.alliance ?? "sans alliance"})</span>
        {node.colonies.map((colony) => (
          <ColonyTree key={colony.pseudo} node={colony} />
        ))}
        {node.more > 0 && (
          <p className="optizzz-muted">
            et {formatAmount(node.more)} {node.more > 1 ? "autres colonies directes" : "autre colonie directe"}
          </p>
        )}
      </li>
    </ul>
  );
}
