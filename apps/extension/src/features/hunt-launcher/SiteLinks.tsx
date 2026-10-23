import { useEffect, useState } from "react";
import { loadToggles } from "@/features/toggles";
import { openSiteTool, siteLinksEnabled, siteToolLink } from "@/utils/site-tool";
import { siteState, type LauncherEntries } from "./site-link";

/** « Ouvrir sur optizzz.fr » and « Copier le lien »: the launcher's entries, in the fragment (never sent to the site). */
export function SiteLinks({ entries }: { entries: LauncherEntries }) {
  const [enabled, setEnabled] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    void loadToggles().then((toggles) => {
      setEnabled(siteLinksEnabled(toggles));
    });
  }, []);
  if (!enabled) return null;
  return (
    <span className="site-links">
      <button
        type="button"
        onClick={() => {
          void openSiteTool("hunt", siteState(entries));
        }}
      >
        Ouvrir sur optizzz.fr
      </button>
      <button
        type="button"
        onClick={() => {
          const link = siteToolLink("hunt", siteState(entries));
          navigator.clipboard.writeText(link).then(
            () => {
              setCopied("Lien copié.");
            },
            () => {
              setCopied(`Le presse-papiers a refusé : ${link}`);
            },
          );
        }}
      >
        Copier le lien
      </button>
      {copied && (
        <span role="status" className="optizzz-note">
          {copied}
        </span>
      )}
    </span>
  );
}
