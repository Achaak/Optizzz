"use client";

import type { Alliance, Player } from "@optizzz/game/exports";
import { diplomaticCamps } from "@optizzz/game/diplomacy";
import { formatNumber } from "@optizzz/game/format/number-format";
import {
  attackableBounds,
  FILTER_LABELS,
  filterSummary,
  isFiltering,
  passesFilter,
  setBound,
  type ChipFilter,
  type FilterKey,
} from "@optizzz/map/filter";
import type { MapPalette } from "@optizzz/map/palette";
import {
  addChip,
  countUnaffiliated,
  playersOf,
  sameTarget,
  searchSuggestions,
  UNAFFILIATED_LABEL,
  type Chip,
  type ChipTarget,
} from "@optizzz/map/selection";
import { useId, useMemo, useState } from "react";
import { NumberField } from "~/components/number-field";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

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

interface Props {
  players: readonly Player[];
  alliances: readonly Alliance[];
  chips: readonly Chip[];
  palette: MapPalette;
  /** The reference's TDC, for « à portée de la référence »; null without a reference. */
  referenceField: number | null;
  onChips: (chips: Chip[], options?: { reframe?: boolean }) => void;
  onAdd: (target: ChipTarget, palette?: readonly string[]) => void;
}

/** Search, the chips, and the buttons that add several at once (pacts, wars, « Sans alliance »). */
export function ChipBar({ players, alliances, chips, palette, referenceField, onChips, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState<ChipTarget | null>(null);
  const listId = useId();
  const suggestions = useMemo(
    () => searchSuggestions(query, players, alliances, chips),
    [query, players, alliances, chips],
  );
  const byId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const unaffiliated = useMemo(() => countUnaffiliated(players), [players]);
  const unaffiliatedChosen = chips.some((chip) => chip.kind === "unaffiliated");
  const allianceChips = chips.filter((chip) => chip.kind === "alliance");
  const [campOf, setCampOf] = useState<string | null>(null);
  const campTag = allianceChips.find((chip) => chip.tag === campOf)?.tag ?? allianceChips[0]?.tag ?? null;
  const camps = campTag ? diplomaticCamps(campTag, alliances) : null;

  const choose = (target: ChipTarget) => {
    onAdd(target);
    setQuery("");
    setActive(0);
  };
  const update = (chip: Chip, change: Partial<Chip>) =>
    onChips(chips.map((other) => (sameTarget(other, chip) ? ({ ...other, ...change } as Chip) : other)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Input
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
            <ul
              id={listId}
              role="listbox"
              className="absolute right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border bg-popover text-sm shadow-md"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={chipKey(suggestion.target)}
                  role="option"
                  aria-selected={index === active}
                  className={`flex cursor-pointer justify-between gap-3 px-3 py-2 ${index === active ? "bg-muted" : ""}`}
                  onMouseDown={(event) => {
                    // Before the field loses the focus.
                    event.preventDefault();
                    choose(suggestion.target);
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  <span>
                    <b>{suggestion.label}</b> <span className="text-muted-foreground">{suggestion.detail}</span>
                  </span>
                  <span className="text-muted-foreground">{KIND_LABEL[suggestion.target.kind]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button
          variant="outline"
          disabled={unaffiliatedChosen || unaffiliated === 0}
          onClick={() => onAdd({ kind: "unaffiliated" })}
        >
          {unaffiliatedChosen ? "Sans alliance ajoutés" : `+ Sans alliance (${formatNumber(unaffiliated)})`}
        </Button>
        {camps && campTag && (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            {allianceChips.length > 1 ? (
              <select
                aria-label="Alliance dont ajouter les pactes et les guerres"
                value={campTag}
                onChange={(event) => setCampOf(event.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2"
              >
                {allianceChips.map((chip) => (
                  <option key={chip.tag} value={chip.tag}>
                    {chip.tag}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-muted-foreground">{campTag} :</span>
            )}
            {(["pacts", "wars"] as const).map((camp) => {
              const missing = camps[camp].filter(
                (tag) => !chips.some((chip) => sameTarget(chip, { kind: "alliance", tag })),
              );
              const label = camp === "pacts" ? "Pactes" : "Guerres";
              return (
                <Button
                  key={camp}
                  variant="outline"
                  disabled={missing.length === 0}
                  title={missing.join(", ") || undefined}
                  onClick={() =>
                    onChips(
                      missing.reduce<Chip[]>(
                        // One hue family per camp: each alliance takes the next colour of its camp.
                        (next, tag) =>
                          addChip(next, { kind: "alliance", tag }, camp === "pacts" ? palette.allies : palette.enemies),
                        [...chips],
                      ),
                      { reframe: true },
                    )
                  }
                >
                  {missing.length > 0
                    ? `+ ${label} (${String(missing.length)})`
                    : camps[camp].length === 0
                      ? camp === "pacts"
                        ? "Aucun pacte"
                        : "Aucune guerre"
                      : `${label} ajoutés`}
                </Button>
              );
            })}
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Sur la carte">
          {chips.map((chip) => {
            const label = labelOf(chip, byId);
            const summary = filterSummary(chip.filter);
            const open = editing !== null && sameTarget(editing, chip);
            return (
              <li key={chipKey(chip)} className="flex items-center gap-2 rounded-full border px-2 py-1 text-sm">
                <label
                  className="relative size-4 cursor-pointer rounded-full border"
                  style={{ background: chip.color }}
                  title="Changer la couleur"
                >
                  <input
                    type="color"
                    value={chip.color}
                    aria-label={`Couleur de ${label}`}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => update(chip, { color: event.target.value })}
                  />
                </label>
                {chip.kind === "player" ? label : <b>{label}</b>}
                {summary && <span className="text-muted-foreground">{summary}</span>}
                {chip.kind !== "player" && (
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-2 hover:underline"
                    aria-expanded={open}
                    onClick={() => setEditing(open ? null : chip)}
                  >
                    filtrer
                  </button>
                )}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Retirer ${label}`}
                  onClick={() => onChips(chips.filter((other) => !sameTarget(other, chip)))}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {chips.map(
        (chip) =>
          editing &&
          sameTarget(editing, chip) && (
            <FilterEditor
              key={chipKey(chip)}
              label={labelOf(chip, byId)}
              chip={chip}
              players={players}
              referenceField={referenceField}
              onChange={(filter) => update(chip, { filter })}
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
  referenceField: number | null;
  onChange: (filter: ChipFilter) => void;
  onClose: () => void;
}) {
  const { label, chip, players, referenceField, onChange, onClose } = props;
  const all = useMemo(() => playersOf(chip, players), [chip, players]);
  const kept = all.filter((player) => passesFilter(player, chip.filter)).length;
  return (
    <fieldset className="space-y-3 rounded-lg border p-3 text-sm">
      <legend className="px-1 font-medium">Filtrer {label}</legend>
      <div className="grid grid-cols-[auto_6rem_auto_6rem_auto] items-center gap-2">
        {FILTER_KEYS.map((key) => (
          <div key={key} className="contents">
            <span>{FILTER_LABELS[key]}</span>
            <NumberField
              value={chip.filter?.[key]?.min ?? null}
              rules={{ min: 0, integer: true, allowEmpty: true, amount: key === "field" }}
              placeholder="min"
              aria-label={`${FILTER_LABELS[key]} minimum`}
              onCommit={(value) => onChange(setBound(chip.filter, key, "min", value))}
            />
            <span>à</span>
            <NumberField
              value={chip.filter?.[key]?.max ?? null}
              rules={{ min: 0, integer: true, allowEmpty: true, amount: key === "field" }}
              placeholder="max"
              aria-label={`${FILTER_LABELS[key]} maximum`}
              onCommit={(value) => onChange(setBound(chip.filter, key, "max", value))}
            />
            {key === "field" && referenceField !== null ? (
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                title={`De 50 % à 300 % du TDC de la référence (${formatNumber(referenceField)} cm²)`}
                onClick={() => {
                  const { min, max } = attackableBounds(referenceField);
                  onChange(setBound(setBound(chip.filter, "field", "min", min), "field", "max", max));
                }}
              >
                à portée de la référence
              </button>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">
          {formatNumber(kept)} joueur{kept > 1 ? "s" : ""} sur {formatNumber(all.length)}
        </span>
        <Button variant="outline" size="sm" disabled={!isFiltering(chip.filter)} onClick={() => onChange({})}>
          Effacer
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </fieldset>
  );
}
