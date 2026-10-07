import { useState } from "react";
import type { MapMember } from "./chart-option";
import { exportLevels, importLevels } from "./level-sharing";

interface Props {
  members: MapMember[];
  levels: ReadonlyMap<number, number>;
  onImport: (levels: Map<number, number>) => void;
}

export function LevelSharing({ members, levels, onImport }: Props) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const handleExport = async () => {
    const exported = exportLevels(levels, members);
    setText(exported);
    try {
      await navigator.clipboard.writeText(exported);
      setMessage("Niveaux copiés dans le presse-papiers.");
    } catch {
      setMessage("Copie le texte ci-dessous.");
    }
  };

  const handleImport = () => {
    const { levels: imported, ignored } = importLevels(text, members);
    onImport(imported);
    setMessage(
      `${imported.size} niveau(x) importé(s).` + (ignored.length ? ` Lignes ignorées : ${ignored.join(" · ")}` : ""),
    );
  };

  return (
    <details className="level-sharing">
      <summary>Partager les niveaux de Vitesse d'attaque</summary>
      <p className="note">
        Format : une ligne « Pseudo: niveau » par membre. Exporte pour coller sur le forum ou Discord, importe ce qu'un
        membre a partagé.
      </p>
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Peanut: 4\nDelta: 7"} />
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
