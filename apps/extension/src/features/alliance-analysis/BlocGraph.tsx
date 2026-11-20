// The bloc's graph, drawn from `blocLayout` (shared with the site).
import { BLOC_HEIGHT, BLOC_WIDTH, blocLayout, type Bloc } from "@optizzz/game/analysis/bloc";
import { formatAmount } from "@optizzz/game/format/number-format";

export function BlocGraph({ bloc }: { bloc: Bloc }) {
  const { nodes, edges, hidden } = blocLayout(bloc);
  const summary = [
    `${bloc.center.tag} au centre`,
    bloc.pacts.length > 0 && `pactes avec ${bloc.pacts.map((pact) => pact.tag).join(", ")}`,
    bloc.wars.length > 0 && `en guerre avec ${bloc.wars.map((war) => war.tag).join(", ")}`,
  ]
    .filter(Boolean)
    .join(" ; ");
  return (
    <figure className="bloc-graph">
      <svg viewBox={`0 0 ${String(BLOC_WIDTH)} ${String(BLOC_HEIGHT)}`} role="img" aria-label={summary}>
        {edges.map((edge, i) => (
          <line
            key={i}
            className={`bloc-edge bloc-edge--${edge.kind}`}
            x1={edge.from.x}
            y1={edge.from.y}
            x2={edge.to.x}
            y2={edge.to.y}
          />
        ))}
        {nodes.map((node) => (
          <g
            key={node.tag}
            className={`bloc-node bloc-node--${node.kind}`}
            transform={`translate(${String(node.x)} ${String(node.y)})`}
          >
            <rect x={-46} y={-18} width={92} height={36} rx={6} />
            <text y={-2} textAnchor="middle">
              {node.tag}
            </text>
            <text y={12} textAnchor="middle" className="bloc-detail">
              {node.detail}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="optizzz-note">
        Trait plein : pacte direct · trait fin : pacte d'un allié · pointillés : guerre, son sens écrit dans la case.
        {hidden > 0 && ` ${formatAmount(hidden)} autres alliances ne tiennent que dans le tableau.`}
      </figcaption>
    </figure>
  );
}
