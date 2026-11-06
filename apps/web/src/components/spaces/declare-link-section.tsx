"use client";

// « Lien de déclaration » in the « Discord » panel (ADR 0010): the link to the page « Déclarer », for an Admin to pin
// on the alliance's channel. « Poster sur Discord » posts it from this browser on the announcements' webhook, opened
// here with the Clé d'alliance; the site never posts it. « Copier le lien » for a space without that webhook.
import { formatEndTime } from "@optizzz/game/format/time-format";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { declareUrl, postDeclareLink } from "~/lib/spaces/declare-link";
import { refusalReason } from "~/lib/spaces/discord";

type Status =
  | { kind: "posted"; at: Date }
  | { kind: "refused"; status: number }
  | { kind: "unreachable" }
  | { kind: "copied" }
  | { kind: "copy-failed" };

export function DeclareLinkSection({ spaceId, webhook }: { spaceId: string; webhook: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const link = () => declareUrl(window.location.origin, spaceId);

  const post = async () => {
    if (!webhook) return;
    setBusy(true);
    const result = await postDeclareLink(fetch, webhook, link());
    setStatus(result.kind === "sent" ? { kind: "posted", at: new Date() } : result);
    setBusy(false);
  };

  return (
    <section className="space-y-2 border-t pt-4" aria-labelledby="declare-link-title">
      <h3 id="declare-link-title" className="font-medium">
        Lien de déclaration
      </h3>
      <p className="text-muted-foreground">
        Pour qu&apos;un membre déclare un flood, un convoi ou une chasse depuis son téléphone, sans l&apos;extension. Le
        lien ne contient rien de l&apos;alliance&nbsp;: la page demande la Clé d&apos;alliance, et chiffre ce qui est
        saisi.
      </p>
      <div className="flex flex-wrap gap-2">
        {webhook && (
          <Button type="button" disabled={busy} onClick={() => void post()}>
            Poster sur Discord
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(link()).then(
              () => setStatus({ kind: "copied" }),
              () => setStatus({ kind: "copy-failed" }),
            );
          }}
        >
          Copier le lien
        </Button>
      </div>
      <p role="status" className="empty:hidden">
        {status?.kind === "posted" &&
          `Posté sur le salon des annonces, ${formatEndTime(status.at, status.at)}. Épinglez-le dans Discord.`}
        {status?.kind === "refused" && `Discord a refusé le message : ${refusalReason(status.status)}.`}
        {status?.kind === "unreachable" && "Discord ne répond pas : réessayez dans un moment."}
        {status?.kind === "copied" && "Lien copié : épinglez-le sur le salon de l'alliance."}
        {status?.kind === "copy-failed" && "Le lien n'a pas pu être copié."}
      </p>
      <p className="text-xs text-muted-foreground">
        {webhook
          ? "Le message part de votre navigateur, par le webhook des annonces : « Déclarez un flood, un convoi ou une chasse sur Optizzz : <lien> ». Le site ne poste rien."
          : "Enregistrez l'adresse du webhook des annonces pour le poster d'ici, ou copiez le lien."}
      </p>
    </section>
  );
}
