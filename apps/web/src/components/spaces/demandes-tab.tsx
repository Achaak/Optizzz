"use client";

// The « Demandes » tab of a space (docs/features/site-demandes.md): « Demandes | Récapitulatif | Historique », the
// view and the Historique's filters kept in the address (`?onglet=demandes&vue=historique&membre=Lasius`).
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { demandesViewSearch, readDemandesView, type DemandesView } from "~/lib/demandes/recap";
import { DemandesHistoryView } from "./demandes-history-view";
import { DemandesPanel } from "./demandes-panel";
import { DemandesRecapView, FORMER_MEMBER } from "./demandes-recap-view";
import { FIELD_LABEL, Panel } from "./parts";

const VIEWS = [
  { value: "demandes", label: "Demandes" },
  { value: "recap", label: "Récapitulatif" },
  { value: "history", label: "Historique" },
] as const;

export function DemandesTab(props: ComponentProps<typeof DemandesPanel>) {
  const { view, demandes, loading } = props;
  const opened = demandes.demandes;
  // The members, and « un ancien membre » when one left Demandes behind: who the Historique can be filtered on.
  const requesters = useMemo(() => {
    const pseudos = view.members.map((m) => m.pseudo);
    return opened?.some((d) => !view.members.some((m) => m.playerId === d.playerId))
      ? [...pseudos, FORMER_MEMBER]
      : pseudos;
  }, [view.members, opened]);
  const params = useSearchParams();
  const [choice, setChoice] = useState<DemandesView>(() => readDemandesView(params, [...requesters, FORMER_MEMBER]));

  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?${demandesViewSearch(choice)}`);
  }, [choice]);

  const change = (next: Partial<DemandesView>) => setChoice((current) => ({ ...current, ...next }));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <span className={FIELD_LABEL}>Vue</span>
        <Segmented label="Vue" options={VIEWS} value={choice.view} onChange={(next) => change({ view: next })} />
      </div>
      {choice.view === "demandes" ? (
        <DemandesPanel {...props} />
      ) : opened === null ? (
        <Panel title={choice.view === "recap" ? "Récapitulatif" : "Historique"}>
          <p className="text-muted-foreground">
            {loading || demandes.loading
              ? "Lecture des Demandes…"
              : "Ouvrez l'accès à l'espace sur cet appareil (onglet « Espace ») pour lire les Demandes de l'alliance."}
          </p>
        </Panel>
      ) : choice.view === "recap" ? (
        <DemandesRecapView
          demandes={opened}
          members={view.members}
          onShowHistory={(requester) => change({ view: "history", requester })}
        />
      ) : (
        <DemandesHistoryView
          demandes={opened}
          convoys={demandes.convoys ?? []}
          requesters={requesters}
          filter={choice}
          onFilter={change}
          now={new Date()}
        />
      )}
    </div>
  );
}
