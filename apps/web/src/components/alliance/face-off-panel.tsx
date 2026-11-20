"use client";
// « Face-à-face avec… » on an alliance's page: read from the face-off route, so that the page stays static. Filled
// in with the alliance of my Space on this server when I am connected (docs/features/analyse-alliances.md).
import type { FaceOff, FaceOffSide } from "@optizzz/game/analysis/face-off";
import { formatCompact, formatNumber } from "@optizzz/game/format/number-format";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Panel } from "~/components/panel";
import { Stat } from "~/components/stat";
import { authClient } from "~/lib/auth-client";
import { api } from "~/trpc/react";

type Answer = { kind: "error"; text: string } | { kind: "done"; with: string; result: FaceOff };

async function fetchFaceOff(server: string, tag: string, other: string): Promise<Answer> {
  try {
    const response = await fetch(
      `/api/${server}/alliances/${encodeURIComponent(tag)}/face-off?with=${encodeURIComponent(other)}`,
    );
    const body = (await response.json()) as FaceOff | { error: string };
    return "error" in body ? { kind: "error", text: body.error } : { kind: "done", with: other, result: body };
  } catch {
    return { kind: "error", text: "Le site ne répond pas : réessayez dans un instant." };
  }
}

const squares = (value: number) => `${formatNumber(Math.round(value))} ${Math.round(value) > 1 ? "cases" : "case"}`;

function SideTable({ title, side }: { title: string; side: FaceOffSide }) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="py-2 text-left font-semibold">{title}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="py-1.5 pr-2 text-left font-medium">
              Pseudo
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              TDC
            </th>
            <th scope="col" className="px-2 py-1.5 text-right font-medium">
              Peut prendre
            </th>
            <th scope="col" className="py-1.5 pl-2 text-left font-medium">
              Le plus proche
            </th>
          </tr>
        </thead>
        <tbody>
          {side.members.map((member) => (
            <tr
              key={member.pseudo}
              className={`border-t border-border ${member.unavailable ? "text-muted-foreground" : ""}`}
            >
              <td className="py-1.5 pr-2 font-semibold">
                {member.pseudo}
                {member.unavailable && <span className="font-normal"> (vacances ou banni)</span>}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(member.field)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatNumber(member.canTake)}</td>
              <td className="py-1.5 pl-2">
                {member.nearest ? `${member.nearest.pseudo}, ${squares(member.nearest.distance)}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The alliance of my Space on this server, to fill the field in; none when I am not connected. */
function useMySpaceAlliance(server: string): string | null {
  const session = authClient.useSession();
  const overview = api.spaces.overview.useQuery(undefined, { enabled: Boolean(session.data), staleTime: 60_000 });
  return overview.data?.players.find((player) => player.server === server && player.alliance)?.alliance ?? null;
}

export function FaceOffPanel({ server, tag }: { server: string; tag: string }) {
  const mine = useMySpaceAlliance(server);
  const prefill = mine && mine.toLowerCase() !== tag.toLowerCase() ? mine : null;
  const [typed, setTyped] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const value = typed ?? prefill ?? "";
  // My Space's alliance is shown at once; another one once asked.
  const shown = asked ?? prefill;
  const query = useQuery({
    queryKey: ["face-off", server, tag, shown],
    queryFn: () => fetchFaceOff(server, tag, shown ?? ""),
    enabled: Boolean(shown),
    staleTime: 600_000,
  });
  const answer: Answer | { kind: "idle" } | { kind: "loading" } = !shown
    ? { kind: "idle" }
    : (query.data ?? { kind: "loading" });

  const exposed = (side: FaceOffSide) =>
    `${formatNumber(side.exposedCount)} membres sur ${formatNumber(side.available)} à portée de l'autre`;
  return (
    <Panel
      title="Face-à-face"
      aside={
        <form
          className="flex items-center gap-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) setAsked(value.trim());
          }}
        >
          <label htmlFor="face-off-with" className="text-muted-foreground">
            Face-à-face avec
          </label>
          <input
            id="face-off-with"
            value={value}
            onChange={(event) => setTyped(event.currentTarget.value)}
            placeholder="Tag"
            className="h-9 w-28 rounded-lg border border-border bg-background px-2"
          />
          <button type="submit" className="h-9 rounded-lg bg-primary px-3 font-semibold text-primary-foreground">
            Voir
          </button>
        </form>
      }
    >
      <p className="text-xs text-muted-foreground">
        Portée : de 50 % (inclus) à 300 % (exclu) du TDC de l&apos;attaquant, dans les deux sens, d&apos;après le
        dernier relevé.{mine ? " Prérempli par l'alliance de votre Espace." : ""}
      </p>
      {answer.kind === "idle" && (
        <p className="mt-3 text-sm text-muted-foreground">Écrivez le tag d&apos;une alliance pour les comparer.</p>
      )}
      {answer.kind === "loading" && <p className="mt-3 text-sm text-muted-foreground">Calcul du face-à-face…</p>}
      {answer.kind === "error" && <p className="mt-3 text-sm">{answer.text}</p>}
      {answer.kind === "done" && (
        <div className="mt-3 space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
            <Stat
              label={`TDC exposé de ${tag}`}
              value={formatCompact(answer.result.theirs.exposedField)}
              hint={exposed(answer.result.theirs)}
            />
            <Stat
              label={`TDC exposé de ${answer.with}`}
              value={formatCompact(answer.result.ours.exposedField)}
              hint={exposed(answer.result.ours)}
            />
            <Stat
              label="Distance médiane"
              value={answer.result.medianDistance === null ? "—" : squares(answer.result.medianDistance)}
              hint="entre les membres des deux alliances"
            />
            <Stat
              label="Hors de toute portée"
              value={`${formatNumber(answer.result.theirs.outOfReach)} · ${formatNumber(answer.result.ours.outOfReach)}`}
              hint={`chez ${tag} · chez ${answer.with}`}
            />
          </div>
          <div className="grid gap-x-6 lg:grid-cols-2">
            <SideTable title={`Membres de ${tag}`} side={answer.result.theirs} />
            <SideTable title={`Membres de ${answer.with}`} side={answer.result.ours} />
          </div>
        </div>
      )}
    </Panel>
  );
}
