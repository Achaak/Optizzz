"use client";

// A space as its member sees it (docs/features/site-comptes-espaces.md, « Page d'un espace »): the access, the
// members, the requests (Admins), the alerts (Admins and Délégués) and the settings. An Admin's gestures are two:
// paste the newcomer's code, then « Donner l'accès »; sealing, signing and the trust list happen without them. The
// same for « Exclure »: one confirmation, and the new access for the others is made without them (ticket 18).
import { formatNumber } from "@optizzz/game/format/number-format";
import { formatDateTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import { isSentCategory, sendsLabel } from "@optizzz/game/site-links/envois";
import { cn } from "cn";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LockIcon, PlusIcon } from "~/components/icons";
import { PageHeader } from "~/components/panel";
import { CopyInvitation } from "~/components/spaces/copy-invitation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { shortDate } from "~/lib/short-date";
import type { Absence } from "~/lib/spaces/absences";
import { certify, excludeMember, grantAccess, withdrawAdmin } from "~/lib/spaces/access";
import { CONVOYS_TAB } from "~/lib/envois/convoy-view";
import { DEMANDES_TAB } from "~/lib/demandes/recap";
import { FLOODS_TAB } from "~/lib/envois/flood-view";
import { HUNTS_TAB } from "~/lib/envois/hunt-view";
import { MOVEMENTS_TAB } from "~/lib/envois/movement-view";
import { askExtensionForMembers } from "~/lib/spaces/extension-bridge";
import { checkMembersList, membersCheckMessage } from "~/lib/spaces/members-check";
import {
  BAD_CERTIFICATE,
  changedKey,
  describeProblem,
  UNREADABLE_TRUST_LIST,
  untrustedAccess,
} from "~/lib/spaces/problems";
import { withCertificates, withVerified } from "~/lib/spaces/trust-store";
import { api } from "~/trpc/react";
import { AdminExchange } from "./admin-exchange";
import { CodeExchange } from "./code-exchange";
import { ChainPanel } from "./chain-panel";
import { ConvoysPanel } from "./convoys-panel";
import { DemandesTab } from "./demandes-tab";
import { DiscordPanel } from "./discord-panel";
import { errorText } from "./errors";
import { FloodsPanel } from "./floods-panel";
import { HuntsPanel } from "./hunts-panel";
import { LeaveSpace } from "./leave-space";
import { MovementsPanel } from "./movements-panel";
import { PassphraseUnlock } from "./passphrase-forms";
import { Callout, Panel } from "./parts";
import { SpaceSettings } from "./space-settings";
import { StatePanel } from "./state-panel";
import { useAbsenceAlerts } from "./use-absence-alerts";
import { useSpaceAccess, type MemberView, type SpaceAccess } from "./use-space-access";
import { useSpaceDemandes } from "./use-space-demandes";
import { useKeyHandover, useSpaceEnvois } from "./use-space-envois";
import { useSpaceKeys } from "./space-keys";
import { CHAIN_TAB, passageAlerts } from "~/lib/spaces/passage";

type Member = MemberView["members"][number];
type Request = MemberView["requests"][number];

const ROLE_LABEL = { admin: "Admin", delegate: "Délégué", member: "Membre" } as const;

/** « vous êtes Admin », under the space's name. */
const YOU_ARE = { admin: "Admin", delegate: "Délégué", member: "membre" } as const;

/** Where « Inviter » leads: the panel with the invitation link, on the « Espace » tab. */
const INVITE_ID = "inviter";

/** « absent depuis le 24/10 à 13 h 36 », Paris time, as Optizzz writes times. */
const absentSince = (absence: Absence) => `absent depuis le ${formatDateTime(new Date(absence.since))}`;

/** Whether this browser does not believe a member's key (« La clé de Pseudo a changé »). */
function keyChanged(member: Member, access: SpaceAccess, view: MemberView): boolean {
  // Without its own access (passphrase just forgotten), one believes nobody yet: nothing to flag.
  if (view.me.keyStatus !== "current") return false;
  if (member.isMe || member.keyStatus !== "current" || !member.publicKey || !access.ready) return false;
  if (member.role === "admin" && !access.trusted.admins.includes(member.publicKey)) return true;
  return view.me.role === "admin" && !access.trusted.members.includes(member.publicKey);
}

const TABS = [
  { value: "space", label: "Espace" },
  { value: "state", label: "État" },
  { value: "movements", label: "Mouvements" },
  { value: "demandes", label: "Demandes" },
  { value: "convoys", label: "Convois" },
  { value: "floods", label: "Floods" },
  { value: "hunts", label: "Chasses" },
  { value: "chain", label: "Chaîne" },
  { value: "discord", label: "Discord" },
  { value: "settings", label: "Réglages" },
] as const;

type Tab = (typeof TABS)[number]["value"];

export function MemberSpace({ view }: { view: MemberView }) {
  const keys = useSpaceKeys();
  const access = useSpaceAccess(keys.pair && keys.trust ? view : undefined);
  const absences = useAbsenceAlerts(view, access.keyring);
  const envois = useSpaceEnvois(view, access.keyring);
  const demandes = useSpaceDemandes(view, access.keyring, envois.items);
  const versionHidden = useKeyHandover(view, access.keyring, keys.userId);
  // A link to the Convois, Floods, Chasses, Mouvements, Chaîne or Demandes tab (`?onglet=convois`) opens on it; the other tabs
  // leave the address bare.
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const asked = params.get("onglet");
    if (asked === CHAIN_TAB) return "chain";
    if (asked === MOVEMENTS_TAB) return "movements";
    if (asked === DEMANDES_TAB) return "demandes";
    if (asked === HUNTS_TAB) return "hunts";
    return asked === CONVOYS_TAB ? "convoys" : asked === FLOODS_TAB ? "floods" : "space";
  });
  useEffect(() => {
    if (
      tab !== "convoys" &&
      tab !== "floods" &&
      tab !== "hunts" &&
      tab !== "chain" &&
      tab !== "movements" &&
      tab !== "demandes" &&
      window.location.search
    )
      window.history.replaceState(null, "", window.location.pathname);
  }, [tab]);
  const server = serverById(view.space.server);
  const isAdmin = view.me.role === "admin";
  const canAct = isAdmin && view.me.keyStatus === "current" && access.keyring !== null && keys.pair !== null;
  const pseudoOf = (publicKey: string | undefined) =>
    view.members.find((m) => m.publicKey === publicKey && m.keyStatus === "current")?.pseudo ?? null;

  const pending = demandes.demandes?.filter((demande) => demande.status === "pending").length ?? 0;
  const passageRoster = api.spaces.passageRoster.useQuery(
    { spaceId: view.space.id },
    { enabled: access.keyring !== null, staleTime: 10 * 60_000 },
  );
  // The floods on their way between members that will fail or take less: the plan's alerts (site-chaine.md).
  const chainAlerts = useMemo(
    () =>
      passageRoster.data && envois.floods
        ? passageAlerts({
            roster: passageRoster.data.members,
            exportAt: passageRoster.data.exportAt?.getTime() ?? null,
            states: envois.states,
            floods: envois.floods,
            now: new Date().getTime(),
          })
        : 0,
    [passageRoster.data, envois.floods, envois.states],
  );
  const counts: Partial<Record<Tab, number>> = {
    demandes: pending,
    convoys: envois.convoys?.filter((c) => c.kind === "transit" && c.at > new Date().getTime()).length ?? 0,
    floods: envois.floods?.filter((f) => f.at > new Date().getTime()).length ?? 0,
    hunts: envois.hunts?.filter((h) => h.returnsAt > new Date().getTime()).length ?? 0,
    space: isAdmin ? view.requests.length : 0,
    chain: chainAlerts,
  };

  // Discord's message is set by an Admin: the tab is theirs only.
  const tabs = TABS.filter((entry) => entry.value !== "discord" || isAdmin);

  /** « Inviter »: the « Espace » tab, scrolled to the invitation link. */
  const invite = () => {
    setTab("space");
    requestAnimationFrame(() => {
      const panel = document.getElementById(INVITE_ID);
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      panel?.querySelector("button")?.focus({ preventScroll: true });
    });
  };

  const header = (
    <div className="space-y-5">
      <PageHeader
        kicker={
          <>
            <Link href="/spaces" className="hover:text-foreground hover:underline">
              Espaces
            </Link>{" "}
            / {view.space.name}
          </>
        }
        title={<span className="break-words">{view.space.name}</span>}
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 bg-raised px-2 py-0.5 text-xs text-muted-foreground">
              <LockIcon width={14} height={14} />
              chiffré de bout en bout · {access.keyring ? "ouvert sur cet appareil" : "fermé sur cet appareil"}
            </span>
            <Button variant="outline" className="h-9.5 gap-1.5 bg-card px-3" onClick={invite}>
              <PlusIcon width={14} height={14} />
              Inviter
            </Button>
          </>
        }
      >
        Espace d&apos;alliance de {view.space.tag} · {server?.name ?? view.space.server} ·{" "}
        {formatNumber(view.members.length)} membre{view.members.length > 1 ? "s" : ""} · vous êtes{" "}
        {YOU_ARE[view.me.role]}
      </PageHeader>
      <nav
        aria-label="Parties de l'Espace"
        className="flex gap-1 overflow-x-auto rounded-[0.875rem] bg-card p-1.5 shadow-panel sm:flex-wrap"
      >
        {tabs.map((entry) => {
          const current = entry.value === tab;
          const count = counts[entry.value] ?? 0;
          return (
            <button
              key={entry.value}
              type="button"
              aria-current={current ? "page" : undefined}
              onClick={() => setTab(entry.value)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap",
                current ? "bg-accent font-semibold" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
              {count > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-[0.6875rem] font-semibold text-primary">
                  {formatNumber(count)}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  if (tab === "state")
    return (
      <div className="space-y-6">
        {header}
        <StatePanel
          states={envois.states}
          refused={envois.refused.states}
          isAdmin={isAdmin}
          loading={envois.loading || (access.keyring !== null && envois.states === null)}
          members={view.members}
          convoys={envois.convoys ?? []}
          floods={envois.floods ?? []}
          sends={envois.sends}
          server={view.space.server}
          tag={view.space.tag}
        />
      </div>
    );

  if (tab === "movements")
    return (
      <div className="space-y-6">
        {header}
        <MovementsPanel
          floods={envois.floods}
          convoys={envois.convoys}
          states={envois.states}
          hunts={envois.hunts}
          refused={envois.refused.floods + envois.refused.convoys + envois.refused.states + envois.refused.hunts}
          members={view.members.map((m) => m.pseudo)}
          me={view.members.find((m) => m.isMe)?.pseudo ?? null}
          loading={
            envois.loading ||
            (access.keyring !== null &&
              (envois.floods === null || envois.convoys === null || envois.states === null || envois.hunts === null))
          }
        />
      </div>
    );

  if (tab === "floods")
    return (
      <div className="space-y-6">
        {header}
        <FloodsPanel
          floods={envois.floods}
          refused={envois.refused.floods}
          isAdmin={isAdmin}
          members={view.members}
          sends={envois.sends}
          server={view.space.server}
          tag={view.space.tag}
          loading={envois.loading || (access.keyring !== null && envois.floods === null)}
        />
      </div>
    );

  if (tab === "hunts")
    return (
      <div className="space-y-6">
        {header}
        <HuntsPanel
          hunts={envois.hunts}
          refused={envois.refused.hunts}
          members={view.members}
          sends={envois.sends}
          tag={view.space.tag}
          loading={envois.loading || (access.keyring !== null && envois.hunts === null)}
        />
      </div>
    );

  if (tab === "demandes")
    return (
      <div className="space-y-6">
        {header}
        <DemandesTab
          view={view}
          demandes={demandes}
          sends={envois.sends}
          convoys={envois.convoys}
          states={envois.states}
          loading={envois.loading}
          onShowConvoys={() => setTab("convoys")}
        />
      </div>
    );

  if (tab === "chain")
    return (
      <div className="space-y-6">
        {header}
        <ChainPanel view={view} keyring={access.keyring} floods={envois.floods} states={envois.states} />
      </div>
    );

  if (tab === "discord")
    return (
      <div className="space-y-6">
        {header}
        <div className="max-w-3xl">
          {access.keyring ? (
            <DiscordPanel view={view} keyring={access.keyring} />
          ) : (
            <Panel title="Discord">
              <p className="text-muted-foreground">
                Ouvrez l&apos;accès à l&apos;espace sur cet appareil (onglet «&nbsp;Espace&nbsp;») pour régler le
                message Discord de l&apos;alliance.
              </p>
            </Panel>
          )}
        </div>
      </div>
    );

  if (tab === "settings")
    return (
      <div className="space-y-6">
        {header}
        <div className="max-w-3xl">
          <SpaceSettings view={view} />
        </div>
      </div>
    );

  if (tab === "convoys")
    return (
      <div className="space-y-6">
        {header}
        <ConvoysPanel
          convoys={envois.convoys}
          refused={envois.refused.convoys}
          members={view.members}
          sends={envois.sends}
          demandeConvoys={demandes.convoys}
          states={envois.states}
          server={view.space.server}
          tag={view.space.tag}
          loading={envois.loading || (access.keyring !== null && envois.convoys === null)}
        />
      </div>
    );

  return (
    <div className="space-y-6">
      {header}

      {view.leaveProposal && <LeaveProposal view={view} alliance={view.leaveProposal.alliance} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <AccessPanel
            view={view}
            access={access}
            pseudoOf={pseudoOf}
            version={envois.version}
            versionHidden={versionHidden}
          />

          {isAdmin && <RequestsPanel view={view} access={access} canAct={canAct} />}

          <MembersPanel view={view} access={access} canAct={canAct} absences={absences} sends={envois.sends} />
        </div>
        <div className="min-w-0 space-y-6">
          {(isAdmin || view.me.role === "delegate") && keys.pair && (
            <AlertsPanel view={view} access={access} isAdmin={isAdmin} pseudoOf={pseudoOf} absences={absences} />
          )}

          <Panel title="Inviter" id={INVITE_ID}>
            <p className="text-muted-foreground">
              Le lien d&apos;invitation mène à cet espace&nbsp;: il ne contient aucun secret. Qui l&apos;ouvre est guidé
              jusqu&apos;à sa demande, que vous verrez ici.
            </p>
            <CopyInvitation spaceId={view.space.id} />
          </Panel>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        L&apos;état des membres (production, armée, chasses, niveaux et chantiers), leurs Demandes, leurs convois et
        leurs floods sont dans les onglets «&nbsp;État&nbsp;», «&nbsp;Demandes&nbsp;», «&nbsp;Convois&nbsp;» et
        «&nbsp;Floods&nbsp;», les rôles de la chaîne de TDC dans «&nbsp;Chaîne&nbsp;»
        {isAdmin ? ", le message Discord dans « Discord »" : ""}, les réglages de l&apos;espace dans
        «&nbsp;Réglages&nbsp;».
      </p>
    </div>
  );
}

/** The export says the Player left the space's alliance: they are offered to leave, never made to. */
function LeaveProposal({ view, alliance }: { view: MemberView; alliance: string | null }) {
  return (
    <Callout tone="warning">
      <div className="space-y-3">
        <p>
          D&apos;après l&apos;export public du jeu, {view.me.pseudo} n&apos;est plus dans {view.space.tag}
          {alliance ? ` : il est maintenant dans ${alliance}` : ", ni dans aucune autre alliance"}. Si vous avez quitté
          l&apos;alliance, quittez aussi cet espace. Si vous y revenez bientôt, vous pouvez rester.
        </p>
        <LeaveSpace view={view} label="Quitter l'espace" />
      </div>
    </Callout>
  );
}

type KeyVersion = ReturnType<typeof useSpaceEnvois>["version"];

/**
 * « Accès changé le 24/10 à 18 h 59 par Lasius (version 2) »: the members can tell each other which version they
 * see, should the site hide the newest from one of them (ADR 0005, « Une version cachée, et l'extension »).
 */
function versionLine(version: NonNullable<KeyVersion>): string {
  const what = version.version === 1 ? "Accès créé" : "Accès changé";
  const by = version.createdByPseudo ? ` par ${version.createdByPseudo}` : "";
  return `${what} le ${formatDateTime(new Date(version.createdAt))}${by} (version ${String(version.version)}).`;
}

function AccessPanel({
  view,
  access,
  pseudoOf,
  version,
  versionHidden,
}: {
  view: MemberView;
  access: SpaceAccess;
  pseudoOf: (key: string | undefined) => string | null;
  version: KeyVersion;
  versionHidden: boolean;
}) {
  const keys = useSpaceKeys();
  const [resetting, setResetting] = useState(false);
  const admins = view.members
    .filter((m) => m.role === "admin" && m.keyStatus === "current" && m.publicKey && !m.isMe)
    .map((m) => ({ pseudo: m.pseudo, publicKey: m.publicKey ?? "" }));

  if (!keys.pair) {
    return (
      <Panel title="Accès à l'espace">
        <PassphraseUnlock />
      </Panel>
    );
  }
  if (keys.trustUnreadable) {
    return (
      <Panel title="Accès à l'espace">
        <Callout>{UNREADABLE_TRUST_LIST}</Callout>
        <Button
          variant="outline"
          disabled={resetting}
          onClick={() => {
            setResetting(true);
            void keys.resetTrust().finally(() => setResetting(false));
          }}
        >
          Recommencer mes vérifications
        </Button>
      </Panel>
    );
  }
  if (!access.ready) return <Panel title="Accès à l'espace">Ouverture de l&apos;espace…</Panel>;

  return (
    <Panel title="Accès à l'espace">
      {keys.trustOlder && (
        <Callout tone="warning">
          Vos vérifications du Code de sécurité ont été remplacées par une version plus ancienne que celle vue sur cet
          appareil. Prévenez-nous.
        </Callout>
      )}
      {view.me.keyStatus === "resend" ? (
        <>
          {view.sealed.length > 0 ? (
            <p>
              {view.versions.some((v) => !view.sealed.some((s) => s.version === v))
                ? "L'accès à l'espace a changé pour tous les membres après le départ de quelqu'un, et le nouveau doit encore vous être donné : vous lisez les données d'avant, pas les nouvelles."
                : "L'accès à l'espace a été redonné à tous les membres après le retrait d'un Admin, et doit encore vous être renvoyé : en attendant, vous lisez ce que vous lisiez déjà."}{" "}
              Échangez le Code de sécurité avec un Admin&nbsp;; il vous renverra l&apos;accès.
            </p>
          ) : (
            <p>
              Votre accès à l&apos;espace doit vous être renvoyé, depuis votre nouvelle phrase secrète. Échangez le Code
              de sécurité avec un Admin&nbsp;: il vous renverra l&apos;accès, et vous lirez l&apos;espace dès qu&apos;il
              l&apos;aura fait.
            </p>
          )}
          <AdminExchange spaceId={view.space.id} admins={admins} verified={access.verified} />
        </>
      ) : access.keyring ? (
        <p className="font-medium">Accès à l&apos;espace ouvert sur cet appareil.</p>
      ) : access.keyringError?.code === "untrusted-signer" ? (
        <>
          <Callout tone="warning">{untrustedAccess(pseudoOf(access.keyringError.signer))}</Callout>
          <AdminExchange spaceId={view.space.id} admins={admins} verified={access.verified} />
        </>
      ) : (
        <Callout>{describeProblem(access.keyringError)}</Callout>
      )}
      {versionHidden && (
        <Callout tone="warning">
          optizzz.fr vous sert une version de l&apos;accès plus ancienne qu&apos;une version déjà vue sur cet appareil :
          rien n&apos;est passé à l&apos;extension. Comparez la version avec les autres membres, et prévenez-nous.
        </Callout>
      )}
      {version && <p className="text-muted-foreground">{versionLine(version)}</p>}
    </Panel>
  );
}

function AlertsPanel({
  view,
  access,
  isAdmin,
  pseudoOf,
  absences,
}: {
  view: MemberView;
  access: SpaceAccess;
  isAdmin: boolean;
  pseudoOf: (key: string | undefined) => string | null;
  absences: Absence[];
}) {
  const changed = view.members.filter((m) => keyChanged(m, access, view));
  const toResend = view.members.filter((m) => m.keyStatus === "resend" && !m.isMe);
  const pending = view.requests.filter((r) => r.status === "pending");
  const alerts: React.ReactNode[] = [
    ...absences.map(
      (a) =>
        `${a.pseudo} : ${absentSince(a)} de la page Membres de ${view.space.tag}. Rien n'est retiré tout seul${isAdmin ? " : excluez-le s'il ne revient pas" : ""}.`,
    ),
    ...(access.badCertificates > 0 ? [BAD_CERTIFICATE] : []),
    ...access.crossRevocations.map(
      ([a, b]) =>
        `${pseudoOf(a) ?? "Un Admin"} et ${pseudoOf(b) ?? "un autre Admin"} se sont retiré l'un l'autre : aucun des deux n'est cru comme Admin tant qu'un autre Admin n'a pas nommé de nouveau celui qui doit le rester.`,
    ),
    ...changed.map(
      (m) =>
        `${changedKey(m.pseudo)} : ce que cette clé signe est refusé jusqu'à un nouvel échange du Code de sécurité avec un Admin.`,
    ),
    ...(isAdmin ? toResend.map((m) => `${m.pseudo} attend que son accès à l'espace lui soit renvoyé.`) : []),
    ...(isAdmin && pending.length > 0
      ? [`${String(pending.length)} demande${pending.length > 1 ? "s" : ""} à rejoindre en attente.`]
      : []),
  ];
  return (
    <Panel title="Alertes">
      {alerts.length === 0 ? (
        <p className="text-muted-foreground">Aucune alerte.</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {alerts.map((alert, index) => (
            <li key={index}>{alert}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Les absences viennent de la page Membres du jeu, lue par l&apos;extension d&apos;un Admin ou d&apos;un Délégué à
        l&apos;ouverture de cette page.
      </p>
    </Panel>
  );
}

/** « Donner l'accès » or « Renvoyer l'accès »: the Members page check first, then sealing and signing. */
function useGrant(view: MemberView, access: SpaceAccess) {
  const { pair } = useSpaceKeys();
  return async (recipient: string, pseudo: string, kind: "member" | "admin") => {
    const answer = await askExtensionForMembers(view.space.server);
    const check = checkMembersList(answer, { tag: view.space.tag, pseudo, now: new Date() });
    if (!check.ok) throw new GrantRefused(membersCheckMessage(check, { pseudo, tag: view.space.tag }));
    if (!pair || !access.keyring) throw new GrantRefused("Votre propre accès à l'espace doit d'abord s'ouvrir.");
    return grantAccess({ me: pair, keyring: access.keyring, recipient, trust: access.trust, kind, now: Date.now() });
  };
}

class GrantRefused extends Error {}

const grantError = (error: unknown) => (error instanceof GrantRefused ? error.message : errorText(error));

function RequestsPanel({ view, access, canAct }: { view: MemberView; access: SpaceAccess; canAct: boolean }) {
  const pending = view.requests.filter((r) => r.status === "pending");
  const refused = view.requests.filter((r) => r.status === "refused");
  return (
    <Panel title="Demandes à rejoindre">
      {pending.length === 0 && <p className="text-muted-foreground">Aucune demande en attente.</p>}
      {pending.map((request) => (
        <RequestRow key={request.id} view={view} access={access} request={request} canAct={canAct} />
      ))}
      {refused.length > 0 && (
        <ul className="space-y-1 text-muted-foreground">
          {refused.map((r) => (
            <li key={r.id}>
              {r.pseudo}, refusée le {shortDate(r.decidedAt ?? r.createdAt, new Date())}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function RequestRow({
  view,
  access,
  request,
  canAct,
}: {
  view: MemberView;
  access: SpaceAccess;
  request: Request;
  canAct: boolean;
}) {
  const keys = useSpaceKeys();
  const utils = api.useUtils();
  const approve = api.spaces.approve.useMutation();
  const refuse = api.spaces.refuse.useMutation();
  const grant = useGrant(view, access);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spaceId = view.space.id;
  const key = request.publicKey;
  const exchanged = key !== null && access.verified(key);

  async function give() {
    if (!key) return;
    setBusy(true);
    setError(null);
    try {
      const { sealed, certificate } = await grant(key, request.pseudo, "member");
      await approve.mutateAsync({ spaceId, requestId: request.id, publicKey: key, sealed, certificate });
      await keys.updateTrust((list) => withCertificates(list, spaceId, [certificate]));
      await utils.spaces.view.invalidate({ spaceId });
    } catch (failure) {
      setError(grantError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[0.625rem] bg-raised p-3.5">
      <p>
        <strong>{request.pseudo}</strong>
        <span className="text-muted-foreground">, demande du {shortDate(request.createdAt, new Date())}</span>
      </p>
      {!canAct || !keys.publicKey || !key ? (
        <p className="text-muted-foreground">
          Votre accès à l&apos;espace doit être ouvert sur cet appareil pour répondre.
        </p>
      ) : (
        <>
          <CodeExchange
            mine={keys.publicKey}
            theirs={key}
            pseudo={request.pseudo}
            side="admin"
            done={exchanged}
            onMatch={async () => {
              await keys.updateTrust((list) =>
                withVerified(list, spaceId, { publicKey: key, role: "member", verifiedAt: Date.now() }),
              );
            }}
          />
          {error && <Callout>{error}</Callout>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!exchanged || busy} onClick={() => void give()}>
              {busy ? "Vérification…" : "Donner l'accès"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                refuse
                  .mutateAsync({ spaceId, requestId: request.id })
                  .then(() => utils.spaces.view.invalidate({ spaceId }))
                  .catch((failure: unknown) => setError(errorText(failure)));
              }}
            >
              Refuser
            </Button>
          </div>
          {!exchanged && (
            <p className="text-xs text-muted-foreground">
              «&nbsp;Donner l&apos;accès&nbsp;» s&apos;active quand le code collé correspond. Il vérifie ensuite
              {` ${request.pseudo} `}sur la dernière page Membres lue par votre extension.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function MembersPanel({
  view,
  access,
  canAct,
  absences,
  sends,
}: {
  view: MemberView;
  access: SpaceAccess;
  canAct: boolean;
  absences: Absence[];
  /** What each member sends, as their extension said (« Envoie : convois »). */
  sends: readonly { playerId: number; categories: string[] }[];
}) {
  const now = new Date();
  const sendsOf = (playerId: number) =>
    sendsLabel((sends.find((s) => s.playerId === playerId)?.categories ?? []).filter(isSentCategory));
  return (
    <Panel title={`Membres (${String(view.members.length)})`}>
      <ul className="divide-y">
        {view.members.map((member) => (
          <li key={member.playerId} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong>{member.pseudo}</strong>
              <span>{ROLE_LABEL[member.role]}</span>
              <span className="text-muted-foreground">membre depuis le {shortDate(member.joinedAt, now)}</span>
              <span className={member.keyStatus === "resend" ? "font-medium" : "text-muted-foreground"}>
                accès {member.keyStatus === "current" ? "à jour" : "à renvoyer"}
              </span>
              {member.isMe && <span className="text-muted-foreground">(vous)</span>}
            </div>
            <p className="text-muted-foreground">{sendsOf(member.playerId)}</p>
            {keyChanged(member, access, view) && <p className="font-medium">⚠ {changedKey(member.pseudo)}</p>}
            {absences
              .filter((a) => a.playerId === member.playerId)
              .map((a) => (
                <p key={a.playerId} className="font-medium">
                  ⚠ {absentSince(a)} de la page Membres de {view.space.tag}
                </p>
              ))}
            {!member.isMe && <MemberActions view={view} access={access} member={member} canAct={canAct} />}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The members whose access is up to date, with the key it is sealed for: whom to seal every version for again. */
const currentMembers = (view: MemberView) =>
  view.members.filter((m) => m.keyStatus === "current").map((m) => ({ playerId: m.playerId, publicKey: m.sealedFor }));

function MemberActions({
  view,
  access,
  member,
  canAct,
}: {
  view: MemberView;
  access: SpaceAccess;
  member: Member;
  canAct: boolean;
}) {
  const keys = useSpaceKeys();
  const utils = api.useUtils();
  const setRole = api.spaces.setRole.useMutation();
  const resend = api.spaces.resend.useMutation();
  const addCertificates = api.spaces.addCertificates.useMutation();
  const exclude = api.spaces.exclude.useMutation();
  const withdraw = api.spaces.withdrawAdmin.useMutation();
  const grant = useGrant(view, access);
  const [open, setOpen] = useState<"exchange" | "exclude" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spaceId = view.space.id;
  const key = member.publicKey;
  const isAdmin = view.me.role === "admin";
  const changed = keyChanged(member, access, view);
  const exchanged = key !== null && access.verified(key);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      setOpen(null);
      await utils.spaces.view.invalidate({ spaceId });
    } catch (failure) {
      setError(grantError(failure));
    } finally {
      setBusy(false);
    }
  };

  const remember = (certificates: string[]) =>
    keys.updateTrust((list) => withCertificates(list, spaceId, certificates));

  // A member: only an Admin whose key changed calls for a gesture (a new exchange).
  if (!isAdmin) {
    if (!changed || member.role !== "admin" || !keys.publicKey || !key) return null;
    return (
      <AdminExchange
        spaceId={spaceId}
        admins={[{ pseudo: member.pseudo, publicKey: key }]}
        verified={access.verified}
      />
    );
  }
  if (!canAct || !keys.pair || !keys.publicKey) return null;
  const me = keys.pair;

  const exchange = key && (open === "exchange" || member.keyStatus === "resend" || changed) && (
    <CodeExchange
      mine={keys.publicKey}
      theirs={key}
      pseudo={member.pseudo}
      side="admin"
      done={exchanged}
      onMatch={async () => {
        await keys.updateTrust((list) =>
          withVerified(list, spaceId, { publicKey: key, role: "member", verifiedAt: Date.now() }),
        );
      }}
    />
  );

  const kind = member.role === "admin" ? "admin" : "member";

  return (
    <div className="space-y-2">
      {exchange}
      {error && <Callout>{error}</Callout>}
      <div className="flex flex-wrap gap-2">
        {member.keyStatus === "resend" && key && (
          <Button
            size="sm"
            disabled={!exchanged || busy}
            onClick={() =>
              void run(async () => {
                const { sealed, certificate } = await grant(key, member.pseudo, kind);
                await resend.mutateAsync({ spaceId, playerId: member.playerId, publicKey: key, sealed, certificate });
                await remember([certificate]);
              })
            }
          >
            Renvoyer l&apos;accès
          </Button>
        )}
        {changed && member.keyStatus === "current" && key && (
          <Button
            size="sm"
            disabled={!exchanged || busy}
            onClick={() =>
              void run(async () => {
                const certificate = await certify({ me, subject: key, kind, trust: access.trust, now: Date.now() });
                await addCertificates.mutateAsync({ spaceId, certificates: [certificate] });
                await remember([certificate]);
              })
            }
          >
            Confirmer {member.pseudo}
          </Button>
        )}
        {member.keyStatus === "current" && key && member.role !== "admin" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!exchanged) {
                setOpen("exchange");
                return;
              }
              void run(async () => {
                const certificate = await certify({
                  me,
                  subject: key,
                  kind: "admin",
                  trust: access.trust,
                  now: Date.now(),
                });
                await setRole.mutateAsync({ spaceId, playerId: member.playerId, role: "admin", certificate });
                await remember([certificate]);
              });
            }}
          >
            Nommer Admin
          </Button>
        )}
        {member.role === "member" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() => setRole.mutateAsync({ spaceId, playerId: member.playerId, role: "delegate" }))
            }
          >
            Nommer Délégué
          </Button>
        )}
        {member.role === "delegate" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => setRole.mutateAsync({ spaceId, playerId: member.playerId, role: "member" }))}
          >
            Retirer Délégué
          </Button>
        )}
        {member.role === "admin" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !access.keyring}
            onClick={() =>
              void run(async () => {
                if (!access.keyring) return;
                const { revocation, resigned, sealed } = await withdrawAdmin({
                  me,
                  keyring: access.keyring,
                  subject: member.sealedFor,
                  trust: access.trust,
                  remaining: currentMembers(view),
                  now: Date.now(),
                });
                await withdraw.mutateAsync({
                  spaceId,
                  playerId: member.playerId,
                  revocation,
                  certificates: resigned,
                  sealed,
                });
                await remember([revocation, ...resigned]);
              })
            }
          >
            Retirer Admin
          </Button>
        )}
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setOpen("exclude")}>
          Exclure
        </Button>
        {open === "exchange" && !exchanged && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
            Annuler
          </Button>
        )}
      </div>
      <AlertDialog
        open={open === "exclude"}
        onOpenChange={(next) => {
          if (!next && !busy) setOpen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exclure {member.pseudo}&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.pseudo} perd tout de suite l&apos;accès à l&apos;espace
              {member.role === "admin" ? ", et son rôle d'Admin" : ""}. Ce qui sera envoyé ensuite lui restera
              illisible&nbsp;; ce qu&apos;il a déjà lu reste lu. Pour revenir, il devra demander de nouveau à rejoindre.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <Callout>{error}</Callout>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy || !access.keyring}
              onClick={() =>
                void run(async () => {
                  if (!access.keyring) return;
                  const prepared = await excludeMember({
                    me,
                    keyring: access.keyring,
                    subject: member.sealedFor,
                    trust: access.trust,
                    remaining: currentMembers(view).filter((m) => m.playerId !== member.playerId),
                    now: Date.now(),
                  });
                  await exclude.mutateAsync({
                    spaceId,
                    playerId: member.playerId,
                    exclusion: prepared.exclusion,
                    certificates: prepared.resigned,
                    version: prepared.version,
                    sealed: prepared.sealed,
                  });
                  await remember([prepared.exclusion, ...prepared.resigned]);
                })
              }
            >
              {busy ? "Exclusion…" : `Exclure ${member.pseudo}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {open === "exchange" && !exchanged && (
        <p className="text-xs text-muted-foreground">
          Pour nommer {member.pseudo} Admin, échangez d&apos;abord le Code de sécurité avec lui.
        </p>
      )}
    </div>
  );
}
