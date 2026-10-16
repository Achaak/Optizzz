import { useId, useMemo, useState } from "react";
import type { Alliance, Player } from "@/data/exports";
import { sameTarget, searchSuggestions, type Chip, type ChipTarget } from "./selection";

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
}

const chipKey = (chip: ChipTarget) => (chip.kind === "player" ? `p${String(chip.id)}` : `a${chip.tag}`);

export function ChipBar({ players, alliances, chips, camps, onAdd, onAddCamp, onRemove, onColor }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const suggestions = useMemo(
    () => searchSuggestions(query, players, alliances, chips),
    [query, players, alliances, chips],
  );
  const byId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

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
                <span className="kind">{suggestion.target.kind === "alliance" ? "alliance" : "joueur"}</span>
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
      <ul className="chips">
        {chips.map((chip) => {
          const label = chip.kind === "alliance" ? chip.tag : (byId.get(chip.id)?.pseudo ?? "joueur disparu");
          return (
            <li key={chipKey(chip)} className="chip">
              <label className="swatch" style={{ background: chip.color }} title="Changer la couleur">
                <input
                  type="color"
                  value={chip.color}
                  aria-label={`Couleur de ${label}`}
                  onChange={(event) => onColor(chip, event.target.value)}
                />
              </label>
              {chip.kind === "alliance" ? <b>{label}</b> : label}
              <button type="button" className="remove" aria-label={`Retirer ${label}`} onClick={() => onRemove(chip)}>
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
