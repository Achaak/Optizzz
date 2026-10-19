import { Fragment, useId, useMemo, useState } from "react";
import { NumberField } from "@/utils/NumberField";
import type { Alliance, Player } from "@/data/exports";
import { formatAmount, formatNumber } from "@/utils/number-format";
import { Amount } from "@/utils/Amount";
import {
  attackableBounds,
  FILTER_LABELS,
  filterSummary,
  isFiltering,
  passesFilter,
  setBound,
  type ChipFilter,
  type FilterKey,
} from "./filter";
import {
  countUnaffiliated,
  playersOf,
  sameTarget,
  searchSuggestions,
  UNAFFILIATED_LABEL,
  type Chip,
  type ChipTarget,
} from "./selection";

interface Props {
  players: readonly Player[];
  alliances: readonly Alliance[];
  chips: readonly Chip[];
  /** Tags of my pacts and wars; null outside an alliance. */
  camps: { pacts: string[]; wars: string[] } | null;
  onAdd: (target: ChipTarget) => void;
  onAddCamp: (camp: "pacts" | "wars") => void;
  onRemove: (chip: Chip) => void;
  onColor: (chip: Chip, color: string) => void;
  onFilter: (chip: Chip, filter: ChipFilter) => void;
  /** My TDC, for the « à ma portée » bounds; null when the map does not know me. */
  myField: number | null;
}

const chipKey = (chip: ChipTarget) =>
  chip.kind === "player" ? `p${String(chip.id)}` : chip.kind === "alliance" ? `a${chip.tag}` : "unaffiliated";

const KIND_LABEL: Record<ChipTarget["kind"], string> = {
  player: "joueur",
  alliance: "alliance",
  unaffiliated: "joueurs",
};

const labelOf = (chip: Chip, byId: ReadonlyMap<number, Player>) =>
  chip.kind === "alliance"
    ? chip.tag
    : chip.kind === "unaffiliated"
      ? UNAFFILIATED_LABEL
      : (byId.get(chip.id)?.pseudo ?? "joueur disparu");

export function ChipBar({
  players,
  alliances,
  chips,
  camps,
  onAdd,
  onAddCamp,
  onRemove,
  onColor,
  onFilter,
  myField,
}: Props) {
  const [query, setQuery] = useState("");
  /** The chip whose filter is open below the chips. */
  const [editing, setEditing] = useState<ChipTarget | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const suggestions = useMemo(
    () => searchSuggestions(query, players, alliances, chips),
    [query, players, alliances, chips],
  );
  const byId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const unaffiliated = useMemo(() => countUnaffiliated(players), [players]);
  const unaffiliatedChosen = chips.some((chip) => chip.kind === "unaffiliated");

  const choose = (target: ChipTarget) => {
    onAdd(target);
    setQuery("");
    setActive(0);
  };

  return (
    <div className="chip-bar">
      <div className="search">
        <input
          type="search"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-label="Ajouter un joueur ou une alliance"
          placeholder="Ajouter un joueur ou une alliance…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") setActive((index) => Math.min(index + 1, suggestions.length - 1));
            else if (event.key === "ArrowUp") setActive((index) => Math.max(index - 1, 0));
            else if (event.key === "Enter" && suggestions[active]) choose(suggestions[active].target);
            else return;
            event.preventDefault();
          }}
        />
        {suggestions.length > 0 && (
          <ul className="suggestions" id={listId} role="listbox">
            {suggestions.map((suggestion, index) => (
              <li
                key={chipKey(suggestion.target)}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  // Before the field loses the focus.
                  event.preventDefault();
                  choose(suggestion.target);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <b>{suggestion.label}</b> <span className="detail">{suggestion.detail}</span>
                <span className="kind">{KIND_LABEL[suggestion.target.kind]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {camps &&
        (["pacts", "wars"] as const).map((camp) => {
          const missing = camps[camp].filter(
            (tag) => !chips.some((chip) => sameTarget(chip, { kind: "alliance", tag })),
          );
          const label = camp === "pacts" ? "Mes pactes" : "Mes guerres";
          return (
            <button
              key={camp}
              type="button"
              disabled={missing.length === 0}
              title={
                camps[camp].length === 0
                  ? `Aucune alliance dans « ${label} »`
                  : missing.length === 0
                    ? "Déjà toutes sur la carte"
                    : missing.join(", ")
              }
              onClick={() => onAddCamp(camp)}
            >
              {missing.length > 0
                ? `+ ${label} (${String(missing.length)})`
                : camps[camp].length === 0
                  ? camp === "pacts"
                    ? "Aucun pacte"
                    : "Aucune guerre"
                  : camp === "pacts"
                    ? "Pactes ajoutés"
                    : "Guerres ajoutées"}
            </button>
          );
        })}
      <button
        type="button"
        disabled={unaffiliatedChosen || unaffiliated === 0}
        title="Les joueurs qui n'ont pas d'alliance"
        onClick={() => onAdd({ kind: "unaffiliated" })}
      >
        {unaffiliatedChosen
          ? "Sans alliance ajoutés"
          : unaffiliated === 0
            ? "Personne sans alliance"
            : `+ Sans alliance (${formatAmount(unaffiliated)})`}
      </button>
      <ul className="chips optizzz-chips">
        {chips.map((chip) => {
          const label = labelOf(chip, byId);
          const summary = filterSummary(chip.filter);
          const open = editing !== null && sameTarget(editing, chip);
          return (
            <li key={chipKey(chip)} className="chip optizzz-chip">
              <label className="swatch" style={{ background: chip.color }} title="Changer la couleur">
                <input
                  type="color"
                  value={chip.color}
                  aria-label={`Couleur de ${label}`}
                  onChange={(event) => onColor(chip, event.target.value)}
                />
              </label>
              {chip.kind === "player" ? label : <b>{label}</b>}
              {summary && <span className="filter-summary">{summary}</span>}
              {chip.kind !== "player" && (
                <button
                  type="button"
                  className={summary ? "filter-toggle active" : "filter-toggle"}
                  aria-expanded={open}
                  title="Filtrer par TDC, Fourmilière ou Technologie"
                  onClick={() => setEditing(open ? null : chip)}
                >
                  filtrer {open ? "▴" : "▾"}
                </button>
              )}
              <button type="button" className="remove" aria-label={`Retirer ${label}`} onClick={() => onRemove(chip)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {chips.map(
        (chip) =>
          editing &&
          sameTarget(editing, chip) && (
            <FilterEditor
              key={chipKey(chip)}
              label={labelOf(chip, byId)}
              chip={chip}
              players={players}
              myField={myField}
              onChange={(filter) => onFilter(chip, filter)}
              onClose={() => setEditing(null)}
            />
          ),
      )}
    </div>
  );
}

const FILTER_KEYS = Object.keys(FILTER_LABELS) as FilterKey[];

function FilterEditor(props: {
  label: string;
  chip: Chip;
  players: readonly Player[];
  /** My TDC, for « à ma portée »; null when the map does not know me. */
  myField: number | null;
  onChange: (filter: ChipFilter) => void;
  onClose: () => void;
}) {
  const { label, chip, players, myField, onChange, onClose } = props;
  const all = useMemo(() => playersOf(chip, players), [chip, players]);
  const kept = all.filter((player) => passesFilter(player, chip.filter)).length;
  return (
    <fieldset className="chip-filter optizzz-well">
      <legend>Filtrer {label}</legend>
      <div className="bounds">
        {FILTER_KEYS.map((key) => (
          <Fragment key={key}>
            <span className="criterion">{FILTER_LABELS[key]}</span>
            {(["min", "max"] as const).map((side) => (
              <Fragment key={side}>
                {side === "max" && <span className="to">à</span>}
                <NumberField
                  value={chip.filter?.[key]?.[side] ?? null}
                  min={0}
                  integer
                  allowEmpty
                  amount={key === "field"}
                  placeholder={side === "min" ? "min" : "max"}
                  aria-label={`${FILTER_LABELS[key]} ${side === "min" ? "minimum" : "maximum"}`}
                  onCommit={(value) => onChange(setBound(chip.filter, key, side, value))}
                />
              </Fragment>
            ))}
            {key === "field" && myField !== null ? (
              <button
                type="button"
                className="optizzz-button-link in-range"
                title={`De 50 % à 300 % de votre TDC (${formatNumber(myField)} cm²)`}
                onClick={() => {
                  const { min, max } = attackableBounds(myField);
                  onChange(setBound(setBound(chip.filter, "field", "min", min), "field", "max", max));
                }}
              >
                à ma portée
              </button>
            ) : (
              <span className="spacer" />
            )}
          </Fragment>
        ))}
      </div>
      <div className="footer">
        <span className="optizzz-note">
          <Amount value={kept} /> joueur{kept > 1 ? "s" : ""} sur <Amount value={all.length} />
        </span>
        <button type="button" disabled={!isFiltering(chip.filter)} onClick={() => onChange({})}>
          Effacer
        </button>
        <button type="button" onClick={onClose}>
          Fermer
        </button>
      </div>
    </fieldset>
  );
}
