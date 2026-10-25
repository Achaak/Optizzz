"use client";

// The « Convois » tab of a space (docs/features/site-envois.md, « Vues »): the members' convoys both ways, on their
// way and delivered, opened in this browser, filterable by member. A state is written in words (« En route »,
// « Livré »), never told by a colour alone (ADR 0003).
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime, formatEndTime } from "@optizzz/game/format/time-format";
import { useState } from "react";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { filterConvoys, type AllianceConvoy, type ConvoyFilter } from "~/lib/envois/convoys";
import { Callout, Panel } from "./parts";

const STATES = [
  { value: "all", label: "Tous" },
  { value: "transit", label: "En route" },
  { value: "delivered", label: "Livrés" },
] as const;

const when = (convoy: AllianceConvoy, now: Date) =>
  convoy.kind === "transit"
    ? `arrivée ${formatEndTime(new Date(convoy.at), now)}`
    : `le ${formatDateTime(new Date(convoy.at))}`;

export function ConvoysPanel({
  convoys,
  refused,
  members,
  loading,
}: {
  /** Null while the access to the space is not open on this device. */
  convoys: AllianceConvoy[] | null;
  refused: number;
  members: readonly { pseudo: string }[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState<ConvoyFilter>({ state: "all", member: null });
  const now = new Date();

  if (convoys === null)
    return (
      <Panel title="Convois">
        <p className="text-muted-foreground">
          {loading
            ? "Lecture des convois…"
            : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les convois de l'alliance."}
        </p>
      </Panel>
    );

  const shown = filterConvoys(convoys, filter, now);
  const total = shown.reduce((sum, c) => ({ food: sum.food + c.food, materials: sum.materials + c.materials }), {
    food: 0,
    materials: 0,
  });

  return (
    <Panel title="Convois">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Segmented
          label="Convois à montrer"
          options={STATES}
          value={filter.state}
          onChange={(state) => setFilter((f) => ({ ...f, state }))}
        />
        <label className="space-y-1">
          <span className="block text-muted-foreground">Membre</span>
          <select
            value={filter.member ?? ""}
            onChange={(event) => setFilter((f) => ({ ...f, member: event.target.value || null }))}
            className="block h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Tous les membres</option>
            {members.map((m) => (
              <option key={m.pseudo} value={m.pseudo}>
                {m.pseudo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {refused > 0 && (
        <Callout tone="warning">
          {refused === 1 ? "Un Envoi ne s'ouvre pas" : `${formatNumber(refused)} Envois ne s'ouvrent pas`} : modifié
          hors de l&apos;extension d&apos;un membre, ou chiffré avec une version de l&apos;accès que vous n&apos;avez
          pas. Il n&apos;est pas compté.
        </Callout>
      )}

      {shown.length === 0 ? (
        <p className="text-muted-foreground">
          {convoys.length === 0
            ? "Aucun convoi pour l'instant : un membre les envoie en cochant « Convois » dans l'extension (Fonctionnalités › Compte Optizzz)."
            : "Aucun convoi ne correspond."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>État</TableHead>
                <TableHead>De</TableHead>
                <TableHead>À</TableHead>
                <TableHead className="text-right">Nourriture</TableHead>
                <TableHead className="text-right">Matériaux</TableHead>
                <TableHead>Quand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((c) => (
                <TableRow key={c.fingerprint}>
                  <TableCell className={c.kind === "transit" ? "font-medium" : undefined}>
                    {c.kind === "transit" ? "En route" : "Livré"}
                  </TableCell>
                  <TableCell>{c.from}</TableCell>
                  <TableCell>{c.to}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(c.food)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(c.materials)}</TableCell>
                  <TableCell title={`Relevé par ${c.reporter}`}>{when(c, now)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {shown.length > 1 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(total.food)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(total.materials)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Seuls les convois des membres qui les envoient à Optizzz apparaissent ici, gardés 90 jours. Un convoi vu par
        celui qui l&apos;envoie et par celui qui le reçoit ne compte qu&apos;une fois. Un convoi arrivé revient en
        «&nbsp;Livré&nbsp;» quand l&apos;un des deux a ouvert sa messagerie.
      </p>
    </Panel>
  );
}
