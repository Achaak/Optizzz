// The colonies an alliance takes part in (docs/features/analyse-alliances.md).
import type { AllianceColonies, ColonyLink, ColonyNode } from "@optizzz/game/analysis/colonies";
import { formatNumber } from "@optizzz/game/format/number-format";
import Link from "next/link";
import { Panel } from "~/components/panel";

const alliancePart = (alliance: string | null) => (alliance ? `(${alliance})` : "(sans alliance)");

/** Shown at once in each list: an alliance of S2 holds hundreds of colonies. */
const SHOWN = 10;

function LinkList({
  server,
  links,
  render,
}: {
  server: string;
  links: ColonyLink[];
  render: (link: ColonyLink) => { first: ColonyLink["master"]; text: string };
}) {
  return (
    <ul className="mt-1 space-y-0.5 text-sm">
      {links.map((link) => {
        const { first, text } = render(link);
        return (
          <li key={`${String(link.master.id)}-${String(link.colony.id)}`}>
            <Link href={`/${server}/players/${String(first.id)}`} className="font-semibold hover:underline">
              {first.pseudo}
            </Link>
            {text}
          </li>
        );
      })}
    </ul>
  );
}

function Links({
  server,
  title,
  links,
  render,
}: {
  server: string;
  title: string;
  links: ColonyLink[];
  render: (link: ColonyLink) => { first: ColonyLink["master"]; text: string };
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">
        {title} ({formatNumber(links.length)})
      </h3>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune.</p>
      ) : (
        <>
          <LinkList server={server} links={links.slice(0, SHOWN)} render={render} />
          {links.length > SHOWN && (
            <details className="mt-1">
              <summary className="cursor-pointer text-sm text-primary">
                Voir les {formatNumber(links.length - SHOWN)} autres
              </summary>
              <LinkList server={server} links={links.slice(SHOWN)} render={render} />
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Tree({ node }: { node: ColonyNode }) {
  return (
    <ul className="pl-5">
      <li>
        {node.pseudo} <span className="text-muted-foreground">{alliancePart(node.alliance)}</span>
        {node.colonies.map((colony) => (
          <Tree key={colony.pseudo} node={colony} />
        ))}
        {node.more > 0 && (
          <p className="pl-5 text-muted-foreground">
            et {formatNumber(node.more)} {node.more > 1 ? "autres colonies directes" : "autre colonie directe"}
          </p>
        )}
      </li>
    </ul>
  );
}

export function ColoniesPanel({ server, colonies }: { server: string; colonies: AllianceColonies }) {
  return (
    <Panel title="Colonies">
      <div className="space-y-4">
        <Links
          server={server}
          title="Membres colonisés par l'extérieur"
          links={colonies.colonizedFromOutside}
          render={(link) => ({
            first: link.colony,
            text: `, par ${link.master.pseudo} ${alliancePart(link.master.alliance)}`,
          })}
        />
        <Links
          server={server}
          title="Colonies tenues hors de l'alliance"
          links={colonies.heldOutside}
          render={(link) => ({
            first: link.master,
            text: ` tient ${link.colony.pseudo} ${alliancePart(link.colony.alliance)}`,
          })}
        />
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Colonisations entre membres ({formatNumber(colonies.internal.length)})
          </summary>
          <ul className="mt-1 space-y-0.5 text-sm">
            {colonies.internal.map((link) => (
              <li key={`${String(link.master.id)}-${String(link.colony.id)}`}>
                {link.master.pseudo} tient {link.colony.pseudo}
              </li>
            ))}
          </ul>
        </details>
        {colonies.chains.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Chaînes sur plus d&apos;un niveau</h3>
            <div className="-ml-5 text-sm">
              {colonies.chains.map((chain) => (
                <Tree key={chain.pseudo} node={chain} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
