"use client";

// The « Floods » tab of a space (docs/features/site-envois.md, « Vues »): the members' attacks on their way, by target,
// with who sends them, the take the Plan de flood expects and the arrival, Paris time; the ones arrived in the last 7
// days on demand. The army sent appears to the Admins only: the site hands it to nobody else.
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatEndTime, formatPastTime } from "@optizzz/game/format/time-format";
import { floodArmyText } from "@optizzz/game/site-links/envoi-floods";
import { useState } from "react";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { floodsByTarget, type AllianceFlood } from "~/lib/envois/floods";
import { Callout, Panel } from "./parts";

const STATES = [
  { value: "transit", label: "En route" },
  { value: "arrived", label: "Arrivés" },
] as const;

const NO_PLAN = "Lancée sans le Plan de flood : prise inconnue.";

export function FloodsPanel({
  floods,
  refused,
  isAdmin,
  loading,
}: {
  /** Null while the access to the space is not open on this device. */
  floods: AllianceFlood[] | null;
  refused: number;
  isAdmin: boolean;
  loading: boolean;
}) {
  const [state, setState] = useState<(typeof STATES)[number]["value"]>("transit");
  const now = new Date();

  if (floods === null)
    return (
      <Panel title="Floods">
        <p className="text-muted-foreground">
          {loading
            ? "Lecture des floods…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les floods de l'alliance."}
        </p>
      </Panel>
    );

  const groups = floodsByTarget(floods, state, now);
  const when = (flood: AllianceFlood) =>
    state === "transit" ? formatEndTime(new Date(flood.at), now) : formatPastTime(new Date(flood.at), now);

  return (
    <Panel title="Floods">
      <Segmented label="Floods à montrer" options={STATES} value={state} onChange={setState} />

      {refused > 0 && (
        <Callout tone="warning">
          {refused === 1 ? "Un Envoi ne s'ouvre pas" : `${formatNumber(refused)} Envois ne s'ouvrent pas`} : modifié
          hors de l&apos;extension d&apos;un membre, ou chiffré avec une version de l&apos;accès que vous n&apos;avez
          pas. Il n&apos;est pas compté.
        </Callout>
      )}

      {groups.length === 0 ? (
        <p className="text-muted-foreground">
          {floods.length === 0
            ? "Aucun flood pour l'instant : un membre envoie ses attaques en route en cochant « Floods » dans l'extension (Fonctionnalités › Compte Optizzz)."
            : state === "transit"
              ? "Aucun flood en route."
              : "Aucun flood arrivé ces 7 derniers jours."}
        </p>
      ) : (
        groups.map((group) => {
          const takes = group.floods.flatMap((f) => (f.take === null ? [] : [f.take]));
          return (
            <section key={group.target} className="space-y-2" aria-label={`Floods sur ${group.target}`}>
              <h3 className="font-medium">
                {group.target}{" "}
                <span className="font-normal text-muted-foreground">
                  · {group.floods.length === 1 ? "1 flood" : `${String(group.floods.length)} floods`}
                </span>
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>De</TableHead>
                      <TableHead className="text-right">Prise attendue</TableHead>
                      <TableHead>Arrivée</TableHead>
                      {isAdmin && <TableHead>Armée envoyée</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.floods.map((f) => (
                      <TableRow key={f.fingerprint}>
                        <TableCell>{f.from}</TableCell>
                        <TableCell className="text-right tabular-nums" title={f.take === null ? NO_PLAN : undefined}>
                          {f.take === null ? "—" : formatNumber(f.take)}
                        </TableCell>
                        <TableCell>{when(f)}</TableCell>
                        {isAdmin && (
                          <TableCell className="tabular-nums">
                            {f.army ? floodArmyText(f.army) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                  {group.floods.length > 1 && takes.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(takes.reduce((sum, take) => sum + take, 0))}
                          {takes.length < group.floods.length && " et plus"}
                        </TableCell>
                        <TableCell colSpan={isAdmin ? 2 : 1} />
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </section>
          );
        })
      )}
      <p className="text-xs text-muted-foreground">
        Seuls les floods des membres qui les envoient à Optizzz apparaissent ici, gardés 7 jours après leur arrivée. La
        prise attendue est celle du Plan de flood&nbsp;; «&nbsp;—&nbsp;» pour une attaque lancée sans lui.{" "}
        {isAdmin
          ? "L'armée envoyée n'est montrée qu'aux Admins : optizzz.fr ne la renvoie qu'à eux (c'est le site qui la réserve, pas le chiffrement)."
          : "L'armée envoyée n'est montrée qu'aux Admins de l'espace."}
      </p>
    </Panel>
  );
}
