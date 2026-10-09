import { useEffect, useMemo, useState } from "react";
import { loadLaunches, type Launch } from "@/data/launches";
import { loadMyLastShare, rememberMyShare, type SharedState } from "@/data/shared-states";
import { fetchGamePage } from "@/utils/game-page";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { collectMyState, type Me, type MyPages, type ShareChoices } from "./my-state";
import { readChoices, writeChoices } from "./settings";
import { formatShare } from "./share-text";

interface Props {
  origin: string;
  /** Null outside an alliance. */
  me: Me | null;
}

const PAGES: Record<keyof MyPages, string> = {
  construction: "/construction.php",
  laboratory: "/laboratoire.php",
  army: "/Armee.php",
  resources: "/Ressources.php",
};

/** Read when the view opens and on « Actualiser »: the player asked for them, never in the background. */
async function readPages(origin: string): Promise<MyPages> {
  const entries = await Promise.all(
    Object.entries(PAGES).map(async ([name, path]) => {
      const page = await fetchGamePage(`${origin}${path}`).catch(() => null);
      return [name, page] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as MyPages;
}

const CHECKS: { key: Exclude<keyof ShareChoices, "army">; label: string }[] = [
  { key: "huntingField", label: "TDC" },
  { key: "workers", label: "Ouvrières" },
  { key: "buildings", label: "Bâtiments" },
  { key: "research", label: "Recherches" },
  { key: "works", label: "Chantiers en cours" },
];

const ARMY: { value: ShareChoices["army"]; label: string }[] = [
  { value: "none", label: "rien" },
  { value: "total", label: "le nombre" },
  { value: "units", label: "par unité" },
];

export function MyState({ origin, me }: Props) {
  const host = new URL(origin).host;
  const [choices, updateChoices] = useStoredSettings(host, readChoices, writeChoices);
  const [read, setRead] = useState<{ pages: MyPages; launches: Launch[]; at: Date } | null>(null);
  const [previous, setPrevious] = useState<SharedState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Bumped by « Actualiser »: the pages are read again.
  const [reading, setReading] = useState(0);

  useEffect(() => {
    let current = true;
    const at = new Date();
    void Promise.all([readPages(origin), loadLaunches(origin, at)]).then(([pages, launches]) => {
      if (current) setRead({ pages, launches, at });
    });
    return () => {
      current = false;
    };
  }, [origin, reading]);

  const refresh = () => {
    setRead(null);
    setMessage(null);
    setReading((count) => count + 1);
  };

  useEffect(() => {
    if (me) void loadMyLastShare(origin, me.alliance).then(setPrevious);
  }, [origin, me]);

  const collected = useMemo(
    () => (read && choices && me ? collectMyState(read.pages, choices, me, read.launches, read.at) : null),
    [read, choices, me],
  );
  const text = collected && formatShare(collected.state, previous);

  if (!me) {
    return (
      <div className="alliance-sharing">
        <h2>Mon état</h2>
        <p>Vous n'êtes dans aucune alliance : il n'y a personne avec qui partager votre état.</p>
      </div>
    );
  }

  const copy = async () => {
    if (!collected || !text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(false);
      setMessage("Copié. Collez-le dans le salon Discord privé de votre alliance.");
    } catch {
      setCopied(true);
      setMessage("Le presse-papiers a refusé : copiez le texte ci-dessous.");
    }
    await rememberMyShare(origin, collected.state);
    setPrevious(collected.state);
  };

  return (
    <div className="alliance-sharing">
      <h2>Mon état</h2>
      <p className="note">
        Ce que vous partagez avec votre alliance ({me.alliance}). Le texte n'est pas chiffré : collez-le seulement dans
        un salon réservé à votre alliance. Les membres l'importent dans « Partage », dans le menu d'alliance.
      </p>

      {choices && (
        <div className="choices">
          {CHECKS.map((check) => (
            <label key={check.key}>
              <input
                type="checkbox"
                checked={choices[check.key]}
                onChange={(event) => {
                  const checked = event.target.checked;
                  updateChoices((current) => ({ ...current, [check.key]: checked }));
                }}
              />{" "}
              {check.label}
            </label>
          ))}
          <span>
            Armée :{" "}
            {ARMY.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="army"
                  checked={choices.army === option.value}
                  onChange={() => updateChoices((current) => ({ ...current, army: option.value }))}
                />{" "}
                {option.label}{" "}
              </label>
            ))}
          </span>
        </div>
      )}

      {!collected ? (
        <p>Lecture de vos pages (Construction, Laboratoire, Armée, Ressources)…</p>
      ) : (
        <>
          {collected.missing.length > 0 && (
            <p className="warning">
              Pages illisibles : {collected.missing.join(", ")}. Ce qu'elles montrent n'est pas dans le texte.
            </p>
          )}
          {collected.state.army?.incomplete && (
            <p className="warning">
              Des troupes sont dehors sans qu'Optizzz puisse les compter (chasse sans Compte+ ou attaque lancée hors du
              Plan de flood) : l'armée partagée est incomplète.
            </p>
          )}
          <pre className="preview">{text}</pre>
          <div className="toolbar">
            <button type="button" onClick={() => void copy()}>
              Copier mon état
            </button>
            <button type="button" onClick={refresh}>
              Actualiser
            </button>
          </div>
          {message && <p className="note">{message}</p>}
          {copied && text && <textarea readOnly rows={8} value={text} onFocus={(event) => event.target.select()} />}
        </>
      )}
    </div>
  );
}
