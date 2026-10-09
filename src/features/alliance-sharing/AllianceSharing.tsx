import { useCallback, useEffect, useMemo, useState } from "react";
import {
  forgetFormerMembers,
  importStates,
  loadMyLastShare,
  loadSharedStates,
  setManualValue,
  type SharedStates,
  type ValueKey,
} from "@/data/shared-states";
import { UNITS, unitLabel } from "@/game/army/units";
import { BUILDINGS, RESEARCH } from "@/game/levels";
import { formatNumber } from "@/utils/number-format";
import { NumberField } from "@/utils/NumberField";
import { formatEndTime, formatPastTime } from "@/utils/time-format";
import { memberRows, type MemberRow } from "./member-rows";
import { parseShares } from "./share-text";

interface Props {
  origin: string;
  /** Null outside an alliance. */
  alliance: string | null;
  /** Nicknames of the members page; null until it is read. */
  members: string[] | null;
}

interface Column {
  key: ValueKey;
  label: string;
  title?: string;
}

const BUILDING_LABELS: Record<string, string> = {
  mushroom: "Champi.",
  foodWarehouse: "Entr. nourr.",
  materialWarehouse: "Entr. mat.",
  nursery: "Couveuse",
  solarium: "Solarium",
  laboratory: "Labo",
  analysisRoom: "Analyse",
  combatRoom: "Combat",
  barracks: "Caserne",
  dome: "Dôme",
  lodge: "Loge",
  aphids: "Pucerons",
  cochineal: "Cochenilles",
};

const RESEARCH_LABELS: Record<string, string> = {
  laying: "Ponte",
  shield: "Bouclier",
  weapons: "Armes",
  architecture: "Archi.",
  animals: "Animaux",
  huntSpeed: "V. chasse",
  attackSpeed: "V. attaque",
  genetics: "Génétique",
  acid: "Acide",
  poison: "Poison",
};

const BUILDING_COLUMNS: Column[] = BUILDINGS.map((b) => ({
  key: `buildings.${b.key}`,
  label: BUILDING_LABELS[b.key] ?? b.name,
  title: b.name,
}));
const RESEARCH_COLUMNS: Column[] = RESEARCH.map((r) => ({
  key: `research.${r.key}`,
  label: RESEARCH_LABELS[r.key] ?? r.name,
  title: r.name,
}));
const SUMMARY_COLUMNS: Column[] = [
  { key: "huntingField", label: "TDC" },
  { key: "workers", label: "Ouvrières" },
  { key: "army", label: "Armée" },
  ...RESEARCH_COLUMNS.filter((c) => ["research.weapons", "research.shield", "research.attackSpeed"].includes(c.key)),
  ...BUILDING_COLUMNS.filter((c) => ["buildings.dome", "buildings.lodge"].includes(c.key)),
];

const GROUPS = [
  { id: "summary", label: "Résumé" },
  { id: "buildings", label: "Bâtiments" },
  { id: "research", label: "Recherches" },
  { id: "army", label: "Armée" },
  { id: "works", label: "Chantiers" },
] as const;
type Group = (typeof GROUPS)[number]["id"];

const COLUMNS: Record<Exclude<Group, "army" | "works">, Column[]> = {
  summary: SUMMARY_COLUMNS,
  buildings: BUILDING_COLUMNS,
  research: RESEARCH_COLUMNS,
};

/** Sorting: by nickname, or by a value, highest first. */
type Sort = "pseudo" | ValueKey;

export function AllianceSharing({ origin, alliance, members }: Props) {
  const [states, setStates] = useState<SharedStates | null>(null);
  const [group, setGroup] = useState<Group>("summary");
  const [sort, setSort] = useState<Sort>("pseudo");
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const reload = useCallback(async () => {
    if (!alliance) return;
    setStates(await loadSharedStates(origin, alliance));
    setNow(new Date());
  }, [origin, alliance]);

  // Former members are forgotten, and my own last share shows in my row.
  useEffect(() => {
    if (!alliance || !members) return;
    void (async () => {
      await forgetFormerMembers(origin, alliance, members);
      const mine = await loadMyLastShare(origin, alliance);
      if (mine) await importStates(origin, alliance, [mine]);
      await reload();
    })();
  }, [origin, alliance, members, reload]);

  const rows = useMemo(() => {
    if (!states || !members) return [];
    const all = memberRows(members, states, now);
    const valueOfRow = (row: MemberRow) => (sort === "pseudo" ? 0 : (row.cells[sort]?.value ?? -1));
    return sort === "pseudo"
      ? [...all].sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr"))
      : [...all].sort((a, b) => valueOfRow(b) - valueOfRow(a));
  }, [states, members, now, sort]);

  if (!alliance) return <div className="alliance-sharing">Vous n'êtes dans aucune alliance.</div>;
  if (!members || !states) return <div className="alliance-sharing">Lecture des membres…</div>;

  const importText = async () => {
    const parsed = parseShares(text, { server: new URL(origin).host.split(".")[0] ?? "", alliance, members });
    const { updated, unchanged } = await importStates(origin, alliance, parsed.states);
    const at = new Date();
    for (const [pseudo, level] of parsed.attackSpeeds) {
      await setManualValue(origin, alliance, pseudo, "research.attackSpeed", level, at);
    }
    const parts = [
      `${String(updated.length)} membre(s) mis à jour`,
      unchanged.length > 0 && `${String(unchanged.length)} inchangé(s)`,
      parsed.attackSpeeds.size > 0 && `${String(parsed.attackSpeeds.size)} Vitesse(s) d'attaque (ancien format)`,
      parsed.ignored.length > 0 && `${String(parsed.ignored.length)} ignoré(s) : ${parsed.ignored.join(" ; ")}`,
    ].filter((part) => part !== false);
    setReport(`${parts.join(", ")}.`);
    setText("");
    await reload();
  };

  const edit = async (pseudo: string, key: ValueKey, value: number | null) => {
    await setManualValue(origin, alliance, pseudo, key, value, new Date());
    await reload();
  };

  const cell = (row: MemberRow, column: Column) => {
    const value = row.cells[column.key];
    const marker = value?.change === "up" ? " ↑" : value?.change === "down" ? " ↓" : "";
    const className = [value?.manual && "manual", value?.change && "changed"].filter(Boolean).join(" ");
    if (editing) {
      return (
        <td key={column.key} className={className}>
          <NumberField
            className="value"
            min={0}
            integer
            allowEmpty
            value={value?.value ?? null}
            onCommit={(entered) => void edit(row.pseudo, column.key, entered)}
          />
          {value?.manual && (
            <button
              type="button"
              className="link"
              title="Revenir à la valeur partagée"
              onClick={() => void edit(row.pseudo, column.key, null)}
            >
              ↺
            </button>
          )}
        </td>
      );
    }
    return (
      <td key={column.key} className={className} title={value?.manual ? "Saisi à la main" : undefined}>
        {value ? `${formatNumber(value.value)}${marker}` : ""}
      </td>
    );
  };

  const header = (column: Column) => (
    <th key={column.key} title={column.title}>
      <button type="button" className="link" onClick={() => setSort(column.key)}>
        {column.label}
      </button>
    </th>
  );

  const nextWork = (row: MemberRow) => row.works.filter((work) => !work.done).sort((a, b) => +a.endsAt - +b.endsAt)[0];

  const memberCell = (row: MemberRow) => (
    <td>
      {row.pseudo}
      {row.readAt === null && <span className="note"> · aucun partage</span>}
    </td>
  );

  const readCell = (row: MemberRow) => <td>{row.readAt ? formatPastTime(row.readAt, now) : ""}</td>;

  let table;
  if (group === "army") {
    table = (
      <table>
        <thead>
          <tr>
            <th>Membre</th>
            {header({ key: "army", label: "Total" })}
            {UNITS.map((unit) => (
              <th key={unit.key} title={unit.name}>
                {unitLabel(unit.key)}
              </th>
            ))}
            <th>Troupes dehors</th>
            <th>Relevé</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const units = states.members[row.pseudo]?.latest.army?.units;
            return (
              <tr key={row.pseudo} className={row.stale ? "stale" : undefined}>
                {memberCell(row)}
                {cell(row, { key: "army", label: "Total" })}
                {UNITS.map((unit) => (
                  <td key={unit.key}>{units?.[unit.key] ? formatNumber(units[unit.key] ?? 0) : ""}</td>
                ))}
                <td>
                  {row.armyIncomplete && "incomplète"}
                  {row.armyReturnsAt && row.armyReturnsAt > now && ` retour ${formatEndTime(row.armyReturnsAt, now)}`}
                </td>
                {readCell(row)}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  } else if (group === "works") {
    table = (
      <table>
        <thead>
          <tr>
            <th>Membre</th>
            <th className="left">Chantiers</th>
            <th>Relevé</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.pseudo} className={row.stale ? "stale" : undefined}>
              {memberCell(row)}
              <td className="left">
                {row.works.map((work) => (
                  <div key={`${work.name}${String(work.level)}`} className={work.done ? "done" : undefined}>
                    {work.name} {work.level} : {work.done ? "terminé" : `fin ${formatEndTime(work.endsAt, now)}`}
                  </div>
                ))}
              </td>
              {readCell(row)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    const columns = COLUMNS[group];
    table = (
      <table>
        <thead>
          <tr>
            <th>
              <button type="button" className="link" onClick={() => setSort("pseudo")}>
                Membre
              </button>
            </th>
            {columns.map(header)}
            {group === "summary" && <th className="left">Prochain chantier</th>}
            <th>Relevé</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const work = nextWork(row);
            return (
              <tr key={row.pseudo} className={row.stale ? "stale" : undefined}>
                {memberCell(row)}
                {columns.map((column) => cell(row, column))}
                {group === "summary" && (
                  <td className="left">
                    {work && `${work.name} ${String(work.level)}, fin ${formatEndTime(work.endsAt, now)}`}
                  </td>
                )}
                {readCell(row)}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <div className="alliance-sharing">
      <h2>Partage {alliance}</h2>
      <p className="note">
        Les états que les membres ont copiés depuis « Mon état » (menu Fourmilière). Collez ci-dessous le salon Discord
        où ils les partagent : Optizzz ne lit que les lignes [optizzz:…]. ↑ ↓ : changé dans les dernières 24 h ; en
        grisé : relevé de plus de 3 jours ; en italique : saisi à la main.
      </p>

      <div className="import">
        <textarea
          rows={4}
          value={text}
          placeholder="Coller les états partagés"
          onChange={(event) => setText(event.target.value)}
        />
        <button type="button" disabled={!text.trim()} onClick={() => void importText()}>
          Importer
        </button>
        {report && <p className="note">{report}</p>}
      </div>

      <div className="toolbar">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className={g.id === group ? "tab active" : "tab"}
            onClick={() => setGroup(g.id)}
          >
            {g.label}
          </button>
        ))}
        {group !== "works" && (
          <label>
            <input type="checkbox" checked={editing} onChange={(event) => setEditing(event.target.checked)} /> Corriger
            à la main
          </label>
        )}
      </div>

      <div className="table-wrap">{table}</div>
    </div>
  );
}
