// Face-à-face, Bloc diplomatique and Colonies under an alliance's page. See docs/features/analyse-alliances.md.
import { useEffect, useMemo, useState } from "react";
import { loadAlliancesExport, loadPlayersExport, type AlliancesExport, type PlayersExport } from "@/data/exports";
import { loadLevelsOf } from "@/data/levels";
import { blocText, diplomaticBloc } from "@optizzz/game/analysis/bloc";
import { allianceColonies, type ColonyLink } from "@optizzz/game/analysis/colonies";
import { faceOff, type FaceOffSide } from "@optizzz/game/analysis/face-off";
import { sameTag } from "@optizzz/game/diplomacy";
import type { Player } from "@optizzz/game/exports";
import { formatAmount, formatCompact } from "@optizzz/game/format/number-format";
import { formatDuration } from "@optizzz/game/format/time-format";
import { distance, travelTime } from "@optizzz/game/travel";
import { BlocGraph } from "./BlocGraph";
import { ColonyTree } from "./ColonyTree";

interface Props {
  origin: string;
  /** The alliance of the page. */
  tag: string;
  /** Mine, from the page header; null outside an alliance. */
  myTag: string | null;
  myPseudo: string | null;
  /** My live field, from the page header. */
  myField: number | null;
  show: { faceOff: boolean; bloc: boolean; colonies: boolean };
}

const squares = (value: number) => `${formatAmount(Math.round(value))} ${Math.round(value) > 1 ? "cases" : "case"}`;

const toInput = (player: Player, field = player.field) => ({
  pseudo: player.pseudo,
  field,
  x: player.x,
  y: player.y,
  unavailable: player.onHoliday || player.isBanned,
});

function SideTable({
  title,
  side,
  tripTo,
}: {
  title: string;
  side: FaceOffSide;
  /** My trip to the member, on their side only. */
  tripTo?: (pseudo: string) => number | null;
}) {
  return (
    <div className="optizzz-scroll">
      <table className="optizzz-table optizzz-table--dense">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Pseudo</th>
            <th className="optizzz-num">TDC</th>
            <th className="optizzz-num">Peut prendre</th>
            <th>Le plus proche qu'il peut prendre</th>
            {tripTo && <th className="optizzz-num">Votre trajet</th>}
          </tr>
        </thead>
        <tbody>
          {side.members.map((member) => {
            const trip = tripTo?.(member.pseudo) ?? null;
            return (
              <tr key={member.pseudo} className={member.unavailable ? "optizzz-muted" : undefined}>
                <td>
                  <a href={`Membre.php?Pseudo=${encodeURIComponent(member.pseudo)}`}>{member.pseudo}</a>
                  {member.unavailable && " (vacances ou banni)"}
                </td>
                <td className="optizzz-num">{formatAmount(member.field)}</td>
                <td className="optizzz-num">{formatAmount(member.canTake)}</td>
                <td>{member.nearest ? `${member.nearest.pseudo}, ${squares(member.nearest.distance)}` : "—"}</td>
                {tripTo && <td className="optizzz-num">{trip === null ? "—" : formatDuration(trip * 1000)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FaceOffBox({
  players,
  tag,
  myTag,
  myPseudo,
  myField,
  attackSpeed,
}: {
  players: readonly Player[];
  tag: string;
  myTag: string;
  myPseudo: string | null;
  myField: number | null;
  attackSpeed: number | null;
}) {
  const result = useMemo(() => {
    const ours = players.filter((player) => player.alliance !== null && sameTag(player.alliance, myTag));
    const theirs = players.filter((player) => player.alliance !== null && sameTag(player.alliance, tag));
    return faceOff(
      ours.map((player) => toInput(player, player.pseudo === myPseudo && myField !== null ? myField : player.field)),
      theirs.map((player) => toInput(player)),
    );
  }, [players, tag, myTag, myPseudo, myField]);
  const me = players.find((player) => player.pseudo === myPseudo);
  const tripTo = (pseudo: string) => {
    const target = players.find((player) => player.pseudo === pseudo);
    return me && target && attackSpeed !== null ? travelTime(distance(me, target), attackSpeed) : null;
  };
  const exposed = (side: FaceOffSide) =>
    `${formatCompact(side.exposedField)} (${formatAmount(side.exposedCount)} membres sur ${formatAmount(side.available)})`;
  return (
    <details className="optizzz-panel optizzz-disclosure" open>
      <summary className="optizzz-panel-title">Face-à-face avec {myTag}</summary>
      <div className="optizzz-stats">
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">TDC exposé de {myTag}</span>
          <span className="optizzz-stat-value">{exposed(result.ours)}</span>
        </div>
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">TDC exposé de {tag}</span>
          <span className="optizzz-stat-value">{exposed(result.theirs)}</span>
        </div>
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">Distance médiane</span>
          <span className="optizzz-stat-value">
            {result.medianDistance === null ? "—" : squares(result.medianDistance)}
          </span>
        </div>
        <div className="optizzz-stat">
          <span className="optizzz-stat-label">Hors de toute portée</span>
          <span className="optizzz-stat-value">
            {formatAmount(result.ours.outOfReach)} · {formatAmount(result.theirs.outOfReach)}
          </span>
          <span className="optizzz-stat-note">
            chez {myTag} · chez {tag}
          </span>
        </div>
      </div>
      <SideTable title={`Membres de ${tag}`} side={result.theirs} tripTo={tripTo} />
      <SideTable title={`Membres de ${myTag}`} side={result.ours} />
      <p className="optizzz-note">
        Portée : de 50 % (inclus) à 300 % (exclu) du TDC de l'attaquant, d'après le dernier export ; votre TDC en
        direct. Seule votre Vitesse d'attaque est connue : le trajet ne se calcule que depuis chez vous.
      </p>
    </details>
  );
}

/** Shown at once in each list: an alliance of S2 holds hundreds of colonies. */
const SHOWN = 10;

function ColonyLinks({
  title,
  links,
  render,
}: {
  title: string;
  links: ColonyLink[];
  render: (link: ColonyLink) => string;
}) {
  return (
    <>
      <h4 className="optizzz-subtitle">
        {title} ({formatAmount(links.length)})
      </h4>
      {links.length === 0 ? (
        <p className="optizzz-note">Aucune.</p>
      ) : (
        <>
          <ul>
            {links.slice(0, SHOWN).map((link) => (
              <li key={`${String(link.master.id)}-${String(link.colony.id)}`}>{render(link)}</li>
            ))}
          </ul>
          {links.length > SHOWN && (
            <details className="optizzz-disclosure">
              <summary>Voir les {formatAmount(links.length - SHOWN)} autres</summary>
              <ul>
                {links.slice(SHOWN).map((link) => (
                  <li key={`${String(link.master.id)}-${String(link.colony.id)}`}>{render(link)}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  );
}

const alliancePart = (alliance: string | null) => (alliance ? `(${alliance})` : "(sans alliance)");

export function AllianceAnalysis({ origin, tag, myTag, myPseudo, myField, show }: Props) {
  const [players, setPlayers] = useState<PlayersExport | null>(null);
  const [alliances, setAlliances] = useState<AlliancesExport | null>(null);
  const [attackSpeed, setAttackSpeed] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayers, (e: unknown) => {
      console.warn("[Optizzz] alliance analysis: players export unavailable", e);
      setError(true);
    });
    if (show.bloc)
      loadAlliancesExport(origin).then(setAlliances, (e: unknown) => {
        console.warn("[Optizzz] alliance analysis: alliances export unavailable", e);
      });
    if (show.faceOff)
      loadLevelsOf(origin, ["attackSpeed"]).then(
        (levels) => setAttackSpeed(levels.attackSpeed),
        () => setAttackSpeed(null),
      );
  }, [origin, show.bloc, show.faceOff]);

  const bloc = useMemo(
    () => (alliances ? diplomaticBloc(tag, alliances.alliances, myTag) : null),
    [alliances, tag, myTag],
  );
  const colonies = useMemo(() => (players ? allianceColonies(tag, players.players) : null), [players, tag]);

  if (error)
    return (
      <div className="optizzz-panel optizzz-panel--danger">
        L'export public de Fourmizzz ne répond pas : analyse de l'alliance indisponible.
      </div>
    );
  if (!players) return <div className="optizzz-panel">Chargement de l'analyse de l'alliance…</div>;

  const other = myTag !== null && !sameTag(myTag, tag);
  return (
    <div className="alliance-analysis">
      {show.faceOff && other && (
        <FaceOffBox
          players={players.players}
          tag={tag}
          myTag={myTag}
          myPseudo={myPseudo}
          myField={myField}
          attackSpeed={attackSpeed}
        />
      )}
      {show.bloc && bloc && (
        <details className="optizzz-panel optizzz-disclosure" open>
          <summary className="optizzz-panel-title">Bloc diplomatique</summary>
          <p>{blocText(bloc)}</p>
          <BlocGraph bloc={bloc} />
          <div className="optizzz-scroll">
            <table className="optizzz-table optizzz-table--dense">
              <thead>
                <tr>
                  <th>Alliance</th>
                  <th>Lien</th>
                  <th className="optizzz-num">TDC</th>
                  <th className="optizzz-num">Membres</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...bloc.pacts.map((pact) => ({ ...pact, link: pact.kind || "pacte" })),
                  ...bloc.wars.map((war) => ({
                    ...war,
                    link:
                      war.side === "both"
                        ? "guerre réciproque"
                        : war.side === "us"
                          ? "guerre déclarée"
                          : "guerre subie",
                  })),
                  ...bloc.secondRing.map((ally) => ({ ...ally, link: `pacte de ${ally.via}` })),
                ].map((row) => (
                  <tr key={row.tag}>
                    <td>
                      <a href={`classementAlliance.php?alliance=${encodeURIComponent(row.tag)}`}>{row.tag}</a>
                    </td>
                    <td>{row.link}</td>
                    <td className="optizzz-num">{formatCompact(row.field)}</td>
                    <td className="optizzz-num">{formatAmount(row.members)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="optizzz-note">
            Pactes lus dans les deux sens. Le TDC du bloc compte l'alliance et ses pactes directs, d'après le dernier
            export.
          </p>
        </details>
      )}
      {show.colonies && colonies && (
        <details className="optizzz-panel optizzz-disclosure" open>
          <summary className="optizzz-panel-title">Colonies</summary>
          <ColonyLinks
            title="Membres colonisés par l'extérieur"
            links={colonies.colonizedFromOutside}
            render={(link) => `${link.colony.pseudo}, par ${link.master.pseudo} ${alliancePart(link.master.alliance)}`}
          />
          <ColonyLinks
            title="Colonies tenues hors de l'alliance"
            links={colonies.heldOutside}
            render={(link) => `${link.master.pseudo} tient ${link.colony.pseudo} ${alliancePart(link.colony.alliance)}`}
          />
          <details className="optizzz-disclosure">
            <summary>Colonisations entre membres ({formatAmount(colonies.internal.length)})</summary>
            <ul>
              {colonies.internal.map((link) => (
                <li key={`${String(link.master.id)}-${String(link.colony.id)}`}>
                  {link.master.pseudo} tient {link.colony.pseudo}
                </li>
              ))}
            </ul>
          </details>
          {colonies.chains.length > 0 && (
            <>
              <h4 className="optizzz-subtitle">Chaînes sur plus d'un niveau</h4>
              {colonies.chains.map((chain) => (
                <ColonyTree key={chain.pseudo} node={chain} />
              ))}
            </>
          )}
        </details>
      )}
    </div>
  );
}
