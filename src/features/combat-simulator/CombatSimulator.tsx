import { useEffect, useMemo, useRef, useState } from "react";
import { battle, PLACES, placeHpBonus, requiredAttack, spoils, type Place, type Stage } from "@/game/army/battle";
import { armyAttack, UNITS } from "@/game/army/units";
import { inRange } from "@/game/attack";
import { formatNumber } from "@/utils/number-format";
import { loadStoredLevels } from "@/data/levels";
import { emptyForm, leaveSide, prefill, readArmyText, toBattle, type Counts, type SimulatorForm } from "./form";
import { isEmptyGarrison, loadGarrison } from "@/data/garrison";
import type { SimulatorSide } from "./open";
import { formatPastTime } from "@/utils/time-format";

const PLACE_LABELS: Record<Place, string> = {
  field: "Terrain de chasse",
  nest: "Fourmilière",
  lodge: "Loge Impériale",
};
const REPLY_LABELS: Record<string, string> = { "1": "100 %", "0.5": "50 %", "0.3": "30 %", "0.1": "10 %" };

interface Props {
  /** Game server whose remembered army fills the form, e.g. "s5.fourmizzz.fr"; null when none is known. */
  server: string | null;
  side: SimulatorSide;
}

function NumberInput({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      aria-label={label}
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={(event) => {
        onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)));
      }}
    />
  );
}

function Levels({ fields }: { fields: { label: string; value: number; onChange: (value: number) => void }[] }) {
  return (
    <div className="levels">
      {fields.map((field) => (
        <label key={field.label}>
          <span>{field.label}</span>
          <NumberInput label={field.label} value={field.value} onChange={field.onChange} />
        </label>
      ))}
    </div>
  );
}

function Paste({ onPaste }: { onPaste: (text: string) => string[] }) {
  const [text, setText] = useState("");
  const [unknown, setUnknown] = useState<string[]>([]);
  return (
    <div className="paste">
      <textarea
        rows={2}
        placeholder="Coller un rapport (« Troupes en défense : … ») ou une liste « 300 Jeunes Soldates, 2 Tanks »"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => {
          setUnknown(onPaste(text));
        }}
      >
        Remplir
      </button>
      {unknown.length > 0 && <p className="note">Unités inconnues ignorées : {unknown.join(", ")}</p>}
    </div>
  );
}

const total = (counts: Counts) => Object.values(counts).reduce<number>((sum, count) => sum + (count ?? 0), 0);

function StageResult({ stage, form }: { stage: Stage; form: SimulatorForm }) {
  const rows = UNITS.map((unit, i) => ({
    unit,
    sent: stage.attackerBefore[i] ?? 0,
    attackerLost: stage.attackerLost[i] ?? 0,
    present: stage.defenderBefore[i] ?? 0,
    defenderLost: stage.defenderLost[i] ?? 0,
  })).filter((row) => row.sent > 0 || row.present > 0);
  const { defender, attacker } = form;
  const needed = requiredAttack(
    UNITS.map((_, i) => stage.defenderBefore[i] ?? 0),
    defender.shield,
    placeHpBonus(stage.place, defender),
  );
  const attack = armyAttack(
    UNITS.map((_, i) => stage.attackerBefore[i] ?? 0),
    attacker,
  );
  const fought = rows.some((row) => row.present > 0);
  return (
    <section className={stage.won ? "stage won" : "stage lost"}>
      <h3>
        {PLACE_LABELS[stage.place]} : {stage.won ? "victoire" : "défaite"}
        {fought && (
          <span className="reply">
            {" "}
            · riposte à {REPLY_LABELS[String(stage.reply)] ?? `${String(stage.reply * 100)} %`}
          </span>
        )}
      </h3>
      {fought ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Unité</th>
                <th>Attaque : envoyées</th>
                <th>perdues</th>
                <th>Défense : présentes</th>
                <th>perdues</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unit.key}>
                  <td>{row.unit.name}</td>
                  <td>{formatNumber(row.sent)}</td>
                  <td>{formatNumber(row.attackerLost)}</td>
                  <td>{formatNumber(row.present)}</td>
                  <td>{formatNumber(row.defenderLost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">
            Attaque {formatNumber(attack)} ; pour une riposte à 50 % : plus de {formatNumber(needed.half)}, à 30 % :
            plus de {formatNumber(needed.thirty)}, à 10 % : plus de {formatNumber(needed.ten)}.
          </p>
        </>
      ) : (
        <p className="note">Personne à cet endroit.</p>
      )}
    </section>
  );
}

export function CombatSimulator({ server, side: initialSide }: Props) {
  const [side, setSide] = useState<SimulatorSide>(initialSide);
  const [form, setForm] = useState<SimulatorForm>(emptyForm);
  const [armyNote, setArmyNote] = useState<string | null>(null);
  const [levelsUnknown, setLevelsUnknown] = useState(false);
  // The form as filled in for the player: what they did not change is emptied when they change side.
  const filled = useRef<SimulatorForm | null>(null);
  const [pastePlace, setPastePlace] = useState<Place>("field");
  const origin = server ? `https://${server}` : null;

  useEffect(() => {
    if (!origin) return;
    void Promise.all([loadGarrison(origin), loadStoredLevels(origin)]).then(([garrison, levels]) => {
      // Army out hunting: the garrison was read empty, the last army seen is used instead.
      const away = garrison && isEmptyGarrison(garrison) ? garrison.previous : null;
      const usable = garrison && away ? { ...garrison, armies: away.armies } : garrison;
      setForm((current) => {
        const next = prefill(current, side, usable, levels);
        filled.current = next;
        return next;
      });
      const date = (at: Date) => formatPastTime(at, new Date());
      setArmyNote(
        !garrison
          ? null
          : away
            ? `armée lue ${date(away.readAt)} (garnison vide ${date(garrison.readAt)} : armée en chasse ?)`
            : `armée lue ${date(garrison.readAt)}`,
      );
      setLevelsUnknown(levels.weapons === undefined || levels.shield === undefined);
    });
  }, [origin, side]);

  const result = useMemo(() => {
    const { attacker, defender } = toBattle(form);
    const fought = battle(attacker, defender, form.target);
    return {
      fought,
      loot: spoils(fought, form.target, {
        weapons: form.attacker.weapons,
        aphids: form.attacker.aphids,
        field: form.defender.field,
        food: form.defender.food,
        materials: form.defender.materials,
      }),
    };
  }, [form]);

  const setAttacker = (patch: Partial<SimulatorForm["attacker"]>) => {
    setForm((current) => ({ ...current, attacker: { ...current.attacker, ...patch } }));
  };
  const setDefender = (patch: Partial<SimulatorForm["defender"]>) => {
    setForm((current) => ({ ...current, defender: { ...current.defender, ...patch } }));
  };
  const setDefenderCount = (place: Place, key: string, count: number) => {
    setForm((current) => ({
      ...current,
      defender: {
        ...current.defender,
        armies: { ...current.defender.armies, [place]: { ...current.defender.armies[place], [key]: count } },
      },
    }));
  };

  const { attacker, defender } = form;
  const ratio = attacker.field > 0 && defender.field > 0 ? defender.field / attacker.field : null;
  const outOfRange = ratio !== null && !inRange(attacker.field, defender.field);
  const attackSent = total(attacker.army) > 0;

  return (
    <main className="simulator">
      <header>
        <h1>Simulateur de combat</h1>
        <p className="note">
          {server ? `Serveur ${server}` : "Aucun serveur connu : passez sur la page Armée du jeu pour pré-remplir."}
          {armyNote && ` · ${armyNote}`}
        </p>
        {levelsUnknown && (
          <p className="warning">
            Armes et Bouclier inconnus : passez par le Laboratoire du jeu pour qu'Optizzz les lise (comptés à 0).
          </p>
        )}
        <p className="warning">
          Règles non vérifiées sur un vrai combat entre joueurs (tutoriel officiel, Outiiil, Calystene) : à prendre
          comme une estimation.
        </p>
      </header>

      <div className="toolbar">
        <fieldset>
          <legend>Lieu attaqué</legend>
          {PLACES.map((place) => (
            <label key={place}>
              <input
                type="radio"
                name="target"
                checked={form.target === place}
                onChange={() => {
                  setForm((current) => ({ ...current, target: place }));
                }}
              />
              {PLACE_LABELS[place]}
            </label>
          ))}
        </fieldset>
        {server && (
          <button
            type="button"
            onClick={() => {
              setForm((current) => leaveSide(current, side, filled.current));
              setSide(side === "attack" ? "defend" : "attack");
            }}
          >
            {side === "attack" ? "Je défends" : "J'attaque"} avec mon armée
          </button>
        )}
      </div>

      <div className="sides">
        <section className="side">
          <h2>Attaquant{side === "attack" && server ? " (vous)" : ""}</h2>
          <Levels
            fields={[
              { label: "Armes", value: attacker.weapons, onChange: (weapons) => setAttacker({ weapons }) },
              { label: "Bouclier", value: attacker.shield, onChange: (shield) => setAttacker({ shield }) },
              { label: "TDC (cm²)", value: attacker.field, onChange: (field) => setAttacker({ field }) },
              { label: "Étable à pucerons", value: attacker.aphids, onChange: (aphids) => setAttacker({ aphids }) },
            ]}
          />
          <table className="army">
            <tbody>
              {UNITS.map((unit) => (
                <tr key={unit.key}>
                  <td>{unit.name}</td>
                  <td>
                    <NumberInput
                      label={unit.name}
                      value={attacker.army[unit.key] ?? 0}
                      onChange={(count) => setAttacker({ army: { ...attacker.army, [unit.key]: count } })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Paste
            onPaste={(text) => {
              const read = readArmyText(text, "attack");
              setAttacker({ army: read.army });
              return read.unknown;
            }}
          />
        </section>

        <section className="side">
          <h2>Défenseur{side === "defend" && server ? " (vous)" : ""}</h2>
          <Levels
            fields={[
              { label: "Armes", value: defender.weapons, onChange: (weapons) => setDefender({ weapons }) },
              { label: "Bouclier", value: defender.shield, onChange: (shield) => setDefender({ shield }) },
              { label: "Dôme", value: defender.dome, onChange: (dome) => setDefender({ dome }) },
              { label: "Loge", value: defender.lodge, onChange: (lodge) => setDefender({ lodge }) },
              { label: "TDC (cm²)", value: defender.field, onChange: (field) => setDefender({ field }) },
              { label: "Nourriture", value: defender.food, onChange: (food) => setDefender({ food }) },
              { label: "Matériaux", value: defender.materials, onChange: (materials) => setDefender({ materials }) },
            ]}
          />
          <table className="army">
            <thead>
              <tr>
                <th></th>
                {PLACES.map((place) => (
                  <th key={place}>{PLACE_LABELS[place]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UNITS.map((unit) => (
                <tr key={unit.key}>
                  <td>{unit.name}</td>
                  {PLACES.map((place) => (
                    <td key={place}>
                      <NumberInput
                        label={`${unit.name}, ${PLACE_LABELS[place]}`}
                        value={defender.armies[place][unit.key] ?? 0}
                        onChange={(count) => setDefenderCount(place, unit.key, count)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <label className="paste-place">
            Remplir :{" "}
            <select
              value={pastePlace}
              onChange={(event) => {
                setPastePlace(event.target.value as Place);
              }}
            >
              {PLACES.map((place) => (
                <option key={place} value={place}>
                  {PLACE_LABELS[place]}
                </option>
              ))}
            </select>
          </label>
          <Paste
            onPaste={(text) => {
              const read = readArmyText(text, "defense");
              setDefender({ armies: { ...defender.armies, [pastePlace]: read.army } });
              return read.unknown;
            }}
          />
        </section>
      </div>

      <section className="results">
        <h2>Résultat</h2>
        {outOfRange && (
          <p className="warning">
            Le TDC du défenseur doit être entre 50 % et 300 % de celui de l'attaquant : cette attaque est impossible.
          </p>
        )}
        {!attackSent ? (
          <p className="note">Ajoutez des unités à l'attaquant.</p>
        ) : (
          <>
            <p className={result.fought.won ? "verdict won" : "verdict lost"}>
              {result.fought.won ? "L'attaque réussit" : "L'attaque échoue"}
              {result.fought.won &&
                (result.loot.colony
                  ? " : la fourmilière devient votre colonie."
                  : ` : ${formatNumber(result.loot.field)} cm²` +
                    (form.target === "nest"
                      ? `, ${formatNumber(result.loot.food)} nourriture et ${formatNumber(result.loot.materials)} matériaux`
                      : "") +
                    ".")}
            </p>
            {result.fought.stages.map((stage) => (
              <StageResult key={stage.place} stage={stage} form={form} />
            ))}
          </>
        )}
      </section>
    </main>
  );
}
