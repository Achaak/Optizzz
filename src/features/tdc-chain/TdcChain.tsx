import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPlayersExport, type Player, type PlayersExport } from "../alliance-map/api";
import { formatExportVersion } from "../alliance-map/dates";
import { levelOf, type KnownLevels } from "../alliance-map/neighbor-table";
import { readSettings as readMapSettings, type Settings as MapSettings } from "../alliance-map/settings";
import { formatDuration } from "../alliance-map/travel";
import { loadLevelsOf } from "../game-levels/levels";
import {
  bridge,
  planChain,
  planTransfer,
  takeMatrix,
  type ChainMember,
  type Gap,
  type Hit,
  type Transfer,
} from "./chain";
import { planText } from "./plan-text";
import { exportRoles, importRoles, proposeRoles, roleLabel, rungs, type Role } from "./roles";
import { defaultFirstArrival, schedule } from "./schedule";
import { readChainSettings, writeChainSettings, type ChainSettings } from "./settings";
import { distance, travelTime } from "@/game/travel";
import { formatNumber } from "@/utils/number-format";
import { formatEndTimeShort } from "@/utils/time-format";

/** Kept above the 50 % limit, as the flood planner: other attacks and hunts may move the fields before arrival. */
const MARGIN = 0.01;
const CLOCK_TICK_MS = 30_000;

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** Hunting fields read live on the members page, by nickname. */
  liveHuntingFields: ReadonlyMap<string, number>;
}

interface Member extends Player {
  /** Live when the members page gave it, else from the export. */
  huntingField: number;
}

const OUT: Role = { kind: "out" };

const roleValue = (role: Role) => (role.kind === "passer" ? `passer:${String(role.rank)}` : role.kind);

function parseRoleValue(value: string): Role {
  if (value.startsWith("passer:")) return { kind: "passer", rank: Number(value.slice("passer:".length)) };
  if (value === "hunter" || value === "granary") return { kind: value };
  return OUT;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** For `<input type="datetime-local">`, in local time. */
const toLocalInput = (date: Date) =>
  `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

export function TdcChain({ origin, loggedInPseudo, liveHuntingFields }: Props) {
  const host = new URL(origin).host;
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapSettings, setMapSettings] = useState<MapSettings | null>(null);
  const [myAttackSpeed, setMyAttackSpeed] = useState<number | null>(null);
  const [settings, setSettings] = useState<ChainSettings | null>(null);
  const [mode, setMode] = useState<"chain" | "transfer">("chain");
  const [transfer, setTransfer] = useState<{ from: number | null; to: number | null; amount: number | null }>({
    from: null,
    to: null,
    amount: null,
  });
  const [firstArrival, setFirstArrival] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [message, setMessage] = useState<string | null>(null);

  const updateSettings = useCallback(
    (update: (current: ChainSettings) => ChainSettings) =>
      setSettings((current) => {
        if (!current) return current;
        const next = update(current);
        void writeChainSettings(host, next);
        return next;
      }),
    [host],
  );

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => setError(String(e)));
    void readMapSettings(host).then(setMapSettings);
    void readChainSettings(host).then(setSettings);
    loadLevelsOf(origin, ["attackSpeed"]).then(
      (levels) => setMyAttackSpeed(levels.attackSpeed),
      () => setMyAttackSpeed(null),
    );
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [origin, host]);

  const me = playersExport?.players.find((p) => p.pseudo === loggedInPseudo) ?? null;
  const allianceTag = me?.alliance ?? null;

  // Players on holiday or banned cannot be attacked: never in the chain.
  const members = useMemo<Member[]>(() => {
    if (!playersExport || !allianceTag) return [];
    return playersExport.players
      .filter((p) => p.alliance === allianceTag && !p.onHoliday && !p.isBanned)
      .map((p) => ({ ...p, huntingField: liveHuntingFields.get(p.pseudo) ?? p.field }));
  }, [playersExport, allianceTag, liveHuntingFields]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const levels = useMemo<KnownLevels | null>(
    () =>
      mapSettings && {
        myId: me?.id ?? null,
        labLevel: myAttackSpeed ?? mapSettings.labLevel,
        manualLevel: mapSettings.manualLevel,
        byPlayer: new Map(Object.entries(mapSettings.playerLevels).map(([id, level]) => [Number(id), level])),
      },
    [mapSettings, me?.id, myAttackSpeed],
  );

  const proposed = useMemo(() => proposeRoles(members.map((m) => ({ id: m.id, field: m.huntingField }))), [members]);
  const storedRoles = settings?.roles;
  const roles = useMemo<Map<number, Role>>(() => {
    if (!storedRoles) return proposed;
    return new Map(members.map((m) => [m.id, storedRoles[m.id] ?? OUT]));
  }, [storedRoles, proposed, members]);
  const storedKeep = settings?.keep;
  const keep = useMemo(
    () => new Map(Object.entries(storedKeep ?? {}).map(([id, field]) => [Number(id), field])),
    [storedKeep],
  );

  const chainMembers = useMemo<ChainMember[]>(() => {
    if (!levels) return [];
    return members
      .filter((m) => (roles.get(m.id) ?? OUT).kind !== "out")
      .map((m) => ({ id: m.id, field: m.huntingField, slots: levelOf(m.id, levels).level + 1 }));
  }, [members, roles, levels]);

  // Highest rung first, then biggest field: the chain reads from top to bottom.
  const heights = useMemo(() => rungs(roles), [roles]);
  const ordered = useMemo(
    () => [...chainMembers].sort((a, b) => (heights.get(b.id) ?? 0) - (heights.get(a.id) ?? 0) || b.field - a.field),
    [chainMembers, heights],
  );

  const plan = useMemo<{ transfers: Transfer[]; gaps: (Gap & { from: number })[] }>(() => {
    if (mode === "chain") return planChain({ members: chainMembers, roles, keep }, MARGIN);
    const { from, to } = transfer;
    if (from === null || to === null || from === to) return { transfers: [], gaps: [] };
    const giver = chainMembers.find((m) => m.id === from);
    const result = planTransfer(chainMembers, { from, to, amount: transfer.amount ?? giver?.field ?? 0 }, MARGIN);
    return "gap" in result ? { transfers: [], gaps: [{ from, ...result.gap }] } : { transfers: [result], gaps: [] };
  }, [mode, chainMembers, roles, keep, transfer]);

  const hits = plan.transfers.flatMap((t) => t.hits);
  const trips = hits.map((hit) => {
    const attacker = byId.get(hit.attackerId);
    const target = byId.get(hit.targetId);
    const level = levels ? levelOf(hit.attackerId, levels) : { level: 0, estimated: true };
    const seconds = attacker && target ? travelTime(distance(attacker, target), level.level) : 0;
    return { seconds, ...level };
  });
  const travels = trips.map((trip) => trip.seconds);
  const arrival = firstArrival ?? defaultFirstArrival(now, travels);
  const slots = schedule(arrival, travels);
  const usedPairs = new Set(hits.map((hit) => `${String(hit.attackerId)}-${String(hit.targetId)}`));

  if (error) return <div className="tdc-chain error">Impossible de charger les joueurs : {error}</div>;
  if (!playersExport || !settings || !levels) return <div className="tdc-chain">Chargement de l'alliance…</div>;
  if (!me || !allianceTag) {
    return (
      <div className="tdc-chain">
        Ton alliance n'apparaît pas dans l'export du {formatExportVersion(playersExport.version)}. Si tu viens de la
        rejoindre, elle apparaîtra après la prochaine mise à jour (chaque nuit à minuit).
      </div>
    );
  }

  const pseudo = (id: number) => byId.get(id)?.pseudo ?? "?";
  const highestPasser = Math.max(0, ...[...roles.values()].map((r) => (r.kind === "passer" ? r.rank : 0)));
  const roleOptions: Role[] = [
    { kind: "granary" },
    ...Array.from({ length: highestPasser + 1 }, (_, i): Role => ({ kind: "passer", rank: highestPasser + 1 - i })),
    { kind: "hunter" },
    OUT,
  ];
  const setRole = (id: number, role: Role) =>
    updateSettings((s) => ({
      ...s,
      roles: Object.fromEntries(members.map((m) => [m.id, m.id === id ? role : (roles.get(m.id) ?? OUT)])),
    }));
  const setKeep = (id: number, field: number | null) =>
    updateSettings((s) => ({
      ...s,
      keep: Object.fromEntries(
        Object.entries({ ...s.keep, [id]: field }).filter((entry): entry is [string, number] => entry[1] !== null),
      ),
    }));

  const launches = hits.map((hit, i) => ({
    attacker: pseudo(hit.attackerId),
    target: pseudo(hit.targetId),
    ants: hit.take,
    departure: slots[i]?.departure ?? arrival,
    arrival: slots[i]?.arrival ?? arrival,
  }));

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(planText(launches, now));
      setMessage("Plan copié : colle-le dans un message collectif.");
    } catch {
      setMessage("Impossible de copier le plan.");
    }
  };

  const gapText = (gap: Gap & { from: number }) => {
    if (gap.reason === "attacks") {
      return `Pas de passage de ${pseudo(gap.from)} vers ${pseudo(gap.above)} : les membres à portée n'ont plus d'attaque libre (Vitesse d'attaque + 1 à la fois). Relance le plan après ces arrivées.`;
    }
    const below = byId.get(gap.below)?.huntingField ?? 0;
    const above = byId.get(gap.above)?.huntingField ?? 0;
    const needed = bridge(below, above, MARGIN);
    const start = gap.below === gap.from ? "" : `, au mieux jusqu'à ${pseudo(gap.below)} (${formatNumber(below)})`;
    const fix =
      "min" in needed
        ? `il faudrait un passeur entre ${formatNumber(needed.min)} et ${formatNumber(needed.max)} cm²`
        : `il faudrait ${String(needed.passers)} passeurs`;
    return `Pas de passage de ${pseudo(gap.from)} vers ${pseudo(gap.above)} (${formatNumber(above)})${start} : ${fix}.`;
  };

  return (
    <div className="tdc-chain">
      <h2>Chaîne de TDC {allianceTag}</h2>
      <p className="meta">
        {chainMembers.length} membres dans la chaîne · positions du {formatExportVersion(playersExport.version)} · TDC{" "}
        {liveHuntingFields.size > 0 ? "en direct (page Membres)" : "de l'export"} · membres en vacances exclus
      </p>
      <p className="rules">
        Règles supposées : une attaque gagnée prend 20 % du TDC de la cible, 1 cm² par fourmi au plus ; la cible doit
        rester entre 50 % (+1 % de marge) et 300 % du TDC de l'attaquant à chaque arrivée ; Vitesse d'attaque + 1
        attaques en route à la fois. On suppose que <b>personne ne défend son Terrain de Chasse</b>.
      </p>

      <section>
        <h3>Rôles</h3>
        <div className="toolbar">
          <button
            type="button"
            onClick={() => updateSettings((s) => ({ ...s, roles: Object.fromEntries(proposed) }))}
            title="Les plus gros en greniers, puis un échelon par portée de l'échelon du dessus, les plus petits en chasseurs"
          >
            Proposer des rôles
          </button>
          {!settings.roles && <span className="note">Rôles proposés d'après le TDC : modifie-les ou garde-les.</span>}
        </div>
        <table className="roles">
          <thead>
            <tr>
              <th>Membre</th>
              <th>TDC</th>
              <th>Rôle</th>
              <th title="Le surplus au-dessus monte vers les greniers">TDC à garder</th>
              <th title="Vitesse d'attaque + 1 (réglable sur la Carte)">Attaques à la fois</th>
            </tr>
          </thead>
          <tbody>
            {[...members]
              .sort((a, b) => b.huntingField - a.huntingField)
              .map((m) => {
                const role = roles.get(m.id) ?? OUT;
                const level = levelOf(m.id, levels);
                return (
                  <tr key={m.id} className={role.kind === "out" ? "out" : undefined}>
                    <td>
                      <a href={`/Membre.php?Pseudo=${encodeURIComponent(m.pseudo)}`}>
                        {m.masterPlayerId !== null && "⛓ "}
                        {m.pseudo}
                      </a>
                      {m.id === me.id && " (toi)"}
                    </td>
                    <td>{formatNumber(m.huntingField)}</td>
                    <td>
                      <select
                        value={roleValue(role)}
                        aria-label={`Rôle de ${m.pseudo}`}
                        onChange={(e) => setRole(m.id, parseRoleValue(e.target.value))}
                      >
                        {roleOptions.map((option) => (
                          <option key={roleValue(option)} value={roleValue(option)}>
                            {roleLabel(option)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {role.kind === "hunter" && (
                        <input
                          type="number"
                          min={0}
                          className="keep"
                          placeholder="—"
                          aria-label={`TDC à garder par ${m.pseudo}`}
                          value={keep.get(m.id) ?? ""}
                          onChange={(e) => setKeep(m.id, e.target.value === "" ? null : Number(e.target.value))}
                        />
                      )}
                    </td>
                    <td
                      className={level.estimated ? "estimated" : undefined}
                      title={`Vitesse d'attaque ${String(level.level)}${level.estimated ? " (niveau par défaut)" : ""}`}
                    >
                      {level.estimated && "≈ "}
                      {level.level + 1}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <RoleSharing
          members={members}
          roles={roles}
          onImport={(imported) =>
            updateSettings((s) => ({
              ...s,
              roles: Object.fromEntries(members.map((m) => [m.id, imported.get(m.id) ?? roles.get(m.id) ?? OUT])),
            }))
          }
        />
      </section>

      <section>
        <h3>Qui peut prendre à qui</h3>
        <p className="note">
          Ligne : l'attaquant ; colonne : la cible. Chaque case donne ce qu'une attaque gagnée prend (20 % de la cible)
          ; vide hors de portée. En couleur : les floods du plan.
        </p>
        <div className="matrix">
          <table>
            <thead>
              <tr>
                <th />
                {ordered.map((m) => (
                  <th key={m.id} className="vertical">
                    <span>{pseudo(m.id)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {takeMatrix(ordered).map((row, i) => {
                const attacker = ordered[i];
                if (!attacker) return null;
                return (
                  <tr key={attacker.id}>
                    <th>
                      {pseudo(attacker.id)} <span className="note">{roleLabel(roles.get(attacker.id) ?? OUT)}</span>
                    </th>
                    {row.map((take, j) => {
                      const target = ordered[j];
                      const used = target && usedPairs.has(`${String(attacker.id)}-${String(target.id)}`);
                      return (
                        <td key={target?.id ?? j} className={used ? "used" : take === null ? "none" : undefined}>
                          {take === null ? "" : formatNumber(take)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Ordre de passage</h3>
        <div className="toolbar">
          <label>
            <input type="radio" checked={mode === "chain"} onChange={() => setMode("chain")} /> Toute la chaîne
          </label>
          <label>
            <input type="radio" checked={mode === "transfer"} onChange={() => setMode("transfer")} /> Un transfert
          </label>
        </div>
        {mode === "chain" ? (
          <p className="note">
            Le TDC de chaque chasseur au-dessus de son « TDC à garder » monte vers le plus petit grenier qu'il peut
            atteindre, par les passeurs. Les passeurs finissent comme ils ont commencé.
          </p>
        ) : (
          <div className="toolbar">
            <label>
              De{" "}
              <select
                value={transfer.from ?? ""}
                onChange={(e) => setTransfer((t) => ({ ...t, from: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">—</option>
                {ordered.map((m) => (
                  <option key={m.id} value={m.id}>
                    {pseudo(m.id)} ({formatNumber(m.field)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              vers{" "}
              <select
                value={transfer.to ?? ""}
                onChange={(e) => setTransfer((t) => ({ ...t, to: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">—</option>
                {ordered.map((m) => (
                  <option key={m.id} value={m.id}>
                    {pseudo(m.id)} ({formatNumber(m.field)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              cm² :{" "}
              <input
                type="number"
                min={1}
                className="keep"
                placeholder="max"
                value={transfer.amount ?? ""}
                onChange={(e) =>
                  setTransfer((t) => ({ ...t, amount: e.target.value === "" ? null : Number(e.target.value) }))
                }
              />
            </label>
          </div>
        )}

        {plan.gaps.map((gap) => (
          <p key={gap.from} className="error">
            {gapText(gap)}
          </p>
        ))}

        {hits.length === 0 ? (
          <p className="note">
            {mode === "chain"
              ? "Rien à faire monter : saisis le « TDC à garder » des chasseurs."
              : "Choisis qui donne et qui reçoit."}
          </p>
        ) : (
          <>
            <div className="toolbar">
              <label>
                Première arrivée :{" "}
                <input
                  type="datetime-local"
                  value={toLocalInput(arrival)}
                  onChange={(e) => setFirstArrival(e.target.value ? new Date(e.target.value) : null)}
                />
              </label>
              {firstArrival && (
                <button type="button" className="link" onClick={() => setFirstArrival(null)}>
                  au plus tôt
                </button>
              )}
              <span className="note">Une arrivée par minute, dans l'ordre.</span>
            </div>
            <PlanSummary transfers={plan.transfers} pseudo={pseudo} />
            <table className="plan">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Départ</th>
                  <th>Attaquant</th>
                  <th>Cible</th>
                  <th title="Fourmis à envoyer : 1 cm² pris par fourmi">Fourmis</th>
                  <th>Trajet</th>
                  <th>Arrivée</th>
                  <th>TDC après</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hits.map((hit: Hit, i) => {
                  const slot = slots[i];
                  const trip = trips[i];
                  const mine = hit.attackerId === me.id;
                  const late = slot !== undefined && slot.departure < now;
                  return (
                    <tr key={i} className={mine ? "mine" : undefined}>
                      <td>{i + 1}</td>
                      <td className={late ? "late" : undefined} title={late ? "Départ déjà passé" : undefined}>
                        {slot && formatEndTimeShort(slot.departure, now)}
                      </td>
                      <td>{pseudo(hit.attackerId)}</td>
                      <td>{pseudo(hit.targetId)}</td>
                      <td>{formatNumber(hit.take)}</td>
                      <td
                        className={trip?.estimated ? "estimated" : undefined}
                        title={
                          trip &&
                          `Vitesse d'attaque ${String(trip.level)}${trip.estimated ? " (niveau par défaut)" : ""}`
                        }
                      >
                        {trip?.estimated && "≈ "}
                        {trip && formatDuration(trip.seconds)}
                      </td>
                      <td>{slot && formatEndTimeShort(slot.arrival, now)}</td>
                      <td>
                        {formatNumber(hit.attackerAfter)} / {formatNumber(hit.targetAfter)}
                      </td>
                      <td>
                        {mine && (
                          <a
                            href={`/ennemie.php?Attaquer=${String(hit.targetId)}&lieu=1`}
                            title="Ouvre le formulaire d'attaque du jeu : tu choisis l'armée et tu valides toi-même"
                          >
                            Attaquer
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="toolbar">
              <button type="button" onClick={() => void copyPlan()}>
                Copier le plan
              </button>
              {message && <span className="note">{message}</span>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PlanSummary({ transfers, pseudo }: { transfers: Transfer[]; pseudo: (id: number) => string }) {
  return (
    <ul className="summary">
      {transfers.map((t, i) => {
        const from = t.path[0] ?? 0;
        const to = t.path.at(-1) ?? 0;
        return (
          <li key={i}>
            {formatNumber(t.moved)} cm² de {pseudo(from)} vers {pseudo(to)}
            {t.path.length > 2 && ` par ${t.path.slice(1, -1).map(pseudo).join(", ")}`}
            {t.path.length > 2 &&
              (t.order === "up"
                ? " (le TDC monte maillon par maillon)"
                : " (le haut de la chaîne frappe d'abord, les passeurs se rechargent ensuite)")}
          </li>
        );
      })}
    </ul>
  );
}

function RoleSharing({
  members,
  roles,
  onImport,
}: {
  members: Member[];
  roles: ReadonlyMap<number, Role>;
  onImport: (roles: Map<number, Role>) => void;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async () => {
    const exported = exportRoles(roles, members);
    setText(exported);
    try {
      await navigator.clipboard.writeText(exported);
      setMessage("Rôles copiés dans le presse-papiers.");
    } catch {
      setMessage("Copie le texte ci-dessous.");
    }
  };

  const handleImport = () => {
    const { roles: imported, ignored } = importRoles(text, members);
    onImport(imported);
    setMessage(
      `${String(imported.size)} rôle(s) importé(s).` +
        (ignored.length ? ` Lignes ignorées : ${ignored.join(" · ")}` : ""),
    );
  };

  return (
    <details className="sharing">
      <summary>Partager les rôles</summary>
      <p className="note">
        Format : une ligne « Pseudo: rôle » par membre (Chasseur, Passeur 1, Passeur 2…, Grenier, Hors chaîne). Avec les
        mêmes rôles, chaque membre retrouve le même plan.
      </p>
      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Peanut: Grenier\nAchak: Passeur 1\nMorel: Chasseur"}
      />
      <div>
        <button type="button" onClick={() => void handleExport()}>
          Exporter
        </button>{" "}
        <button type="button" onClick={handleImport} disabled={!text.trim()}>
          Importer
        </button>
      </div>
      {message && <p className="note">{message}</p>}
    </details>
  );
}
