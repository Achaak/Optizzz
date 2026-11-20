// The alliance's diplomatic bloc: its graph, drawn from `blocLayout` like the extension's, and its list.
import { BLOC_HEIGHT, BLOC_WIDTH, blocLayout, blocText, type Bloc } from "@optizzz/game/analysis/bloc";
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import Link from "next/link";
import { Panel } from "~/components/panel";

const WAR_LINK = { us: "guerre déclarée", them: "guerre subie", both: "guerre réciproque" } as const;

export function BlocPanel({ server, bloc }: { server: string; bloc: Bloc }) {
  const { nodes, edges, hidden } = blocLayout(bloc);
  const href = (tag: string) => `/${server}/alliances/${encodeURIComponent(tag)}`;
  const rows = [
    ...bloc.pacts.map((pact) => ({ ...pact, link: pact.kind || "pacte" })),
    ...bloc.wars.map((war) => ({ ...war, link: WAR_LINK[war.side] })),
    ...bloc.secondRing.map((ally) => ({ ...ally, link: `pacte de ${ally.via}` })),
  ];
  const summary = [
    `${bloc.center.tag} au centre`,
    bloc.pacts.length > 0 && `pactes avec ${bloc.pacts.map((pact) => pact.tag).join(", ")}`,
    bloc.wars.length > 0 && `en guerre avec ${bloc.wars.map((war) => war.tag).join(", ")}`,
  ]
    .filter(Boolean)
    .join(" ; ");
  return (
    <Panel title="Bloc diplomatique" aside={<span className="text-sm">{blocText(bloc)}</span>}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ni pacte ni guerre dans l&apos;export.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <figure className="m-0">
            <svg
              viewBox={`0 0 ${String(BLOC_WIDTH)} ${String(BLOC_HEIGHT)}`}
              role="img"
              aria-label={summary}
              className="h-auto w-full rounded-[0.625rem] bg-raised"
            >
              {edges.map((edge, i) => (
                <line
                  key={i}
                  x1={edge.from.x}
                  y1={edge.from.y}
                  x2={edge.to.x}
                  y2={edge.to.y}
                  stroke={edge.kind === "war" ? "var(--info)" : "var(--primary)"}
                  strokeWidth={edge.kind === "ally" ? 1.5 : edge.kind === "war" ? 2.5 : 3}
                  strokeOpacity={edge.kind === "ally" ? 0.45 : 1}
                  // Wars dashed: a shape, not only a colour (ADR 0003).
                  strokeDasharray={edge.kind === "war" ? "7 6" : undefined}
                />
              ))}
              {nodes.map((node) => (
                <g key={node.tag} transform={`translate(${String(node.x)} ${String(node.y)})`}>
                  <rect
                    x={-46}
                    y={-18}
                    width={92}
                    height={36}
                    rx={7}
                    fill={node.kind === "center" ? "var(--primary)" : "var(--card)"}
                    stroke={
                      node.kind === "war" ? "var(--info)" : node.kind === "ally" ? "var(--border)" : "var(--primary)"
                    }
                    strokeWidth={node.kind === "ally" ? 1 : 2}
                    strokeDasharray={node.kind === "war" ? "7 6" : node.kind === "ally" ? "3 3" : undefined}
                  />
                  <text
                    y={-2}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={700}
                    fill={node.kind === "center" ? "var(--primary-foreground)" : "var(--foreground)"}
                  >
                    {node.tag}
                  </text>
                  <text
                    y={12}
                    textAnchor="middle"
                    fontSize={10}
                    fill={node.kind === "center" ? "var(--primary-foreground)" : "var(--muted-foreground)"}
                  >
                    {node.detail}
                  </text>
                </g>
              ))}
            </svg>
            <figcaption className="mt-2 text-xs text-muted-foreground">
              Trait plein : pacte direct · trait fin : pacte d&apos;un allié · pointillés : guerre, son sens écrit dans
              la case. Pactes lus dans les deux sens.
              {hidden > 0 && ` ${formatNumber(hidden)} autres alliances ne tiennent que dans le tableau.`}
            </figcaption>
          </figure>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                    Alliance
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-left font-medium">
                    Lien
                  </th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">
                    TDC
                  </th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-medium">
                    Membres
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.tag} className="border-t border-border">
                    <td className="py-1.5 pr-2">
                      <Link href={href(row.tag)} className="font-semibold hover:underline">
                        {row.tag}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5">{row.link}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatCompact(row.field)}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">{formatNumber(row.members)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}
