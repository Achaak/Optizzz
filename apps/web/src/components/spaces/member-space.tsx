"use client";

// A space as its member sees it (docs/features/site-comptes-espaces.md, « Page d'un espace »): the access, the
// members, the requests (Admins), the alerts (Admins and Délégués) and the settings. An Admin's gestures are two:
// paste the newcomer's code, then « Donner l'accès »; sealing, signing and the trust list happen without them. The
// same for « Exclure »: one confirmation, and the new access for the others is made without them (ticket 18).
import { formatDateTime } from "@optizzz/game/format/time-format";
import { serverById } from "@optizzz/game/servers";
import { isSentCategory, sendsLabel } from "@optizzz/game/site-links/envois";
import { useState } from "react";
import { CopyInvitation } from "~/components/spaces/copy-invitation";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
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
import { ConvoysPanel } from "./convoys-panel";
import { DemandesPanel } from "./demandes-panel";
import { DiscordPanel } from "./discord-panel";
import { errorText } from "./errors";
import { FloodsPanel } from "./floods-panel";
import { LeaveSpace } from "./leave-space";
import { PassphraseUnlock } from "./passphrase-forms";
import { Callout, Panel } from "./parts";
import { SpaceSettings } from "./space-settings";
import { StatePanel } from "./state-panel";
import { useAbsenceAlerts } from "./use-absence-alerts";
import { useSpaceAccess, type MemberView, type SpaceAccess } from "./use-space-access";
import { useSpaceDemandes } from "./use-space-demandes";
import { useKeyHandover, useSpaceEnvois } from "./use-space-envois";
import { useSpaceKeys } from "./space-keys";

type Member = MemberView["members"][number];
type Request = MemberView["requests"][number];

const ROLE_LABEL = { admin: "Admin", delegate: "Délégué", member: "Membre" } as const;

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
  { value: "floods", label: "Floods" },
  { value: "convoys", label: "Convois" },
  { value: "demandes", label: "Demandes" },
] as const;

export function MemberSpace({ view }: { view: MemberView }) {
  const keys = useSpaceKeys();
  const access = useSpaceAccess(keys.pair && keys.trust ? view : undefined);
  const absences = useAbsenceAlerts(view, access.keyring);
  const envois = useSpaceEnvois(view, access.keyring);
  const demandes = useSpaceDemandes(view, access.keyring, envois.items);
  const versionHidden = useKeyHandover(view, access.keyring, keys.userId);
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("space");
  const server = serverById(view.space.server);
  const isAdmin = view.me.role === "admin";
  const canAct = isAdmin && view.me.keyStatus === "current" && access.keyring !== null && keys.pair !== null;
  const pseudoOf = (publicKey: string | undefined) =>
    view.members.find((m) => m.publicKey === publicKey && m.keyStatus === "current")?.pseudo ?? null;

  const header = (
    <div className="space-y-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{view.space.name}</h1>
        <p className="text-sm text-muted-foreground">
          Espace d&apos;alliance de {view.space.tag} sur {server?.name ?? view.space.server} · {view.me.pseudo},{" "}
          {ROLE_LABEL[view.me.role].toLowerCase()}
        </p>
      </div>
      <Segmented label="Partie de l'espace" options={TABS} value={tab} onChange={setTab} />
    </div>
  );

  if (tab === "state")
    return (
      <div className="max-w-5xl space-y-6">
        {header}
        <StatePanel
          states={envois.states}
          refused={envois.refused.states}
          isAdmin={isAdmin}
          loading={envois.loading || (access.keyring !== null && envois.states === null)}
          members={view.members.map((m) => m.pseudo)}
          server={view.space.server}
          tag={view.space.tag}
        />
      </div>
    );

  if (tab === "floods")
    return (
      <div className="max-w-3xl space-y-6">
        {header}
        <FloodsPanel
          floods={envois.floods}
          refused={envois.refused.floods}
          isAdmin={isAdmin}
          loading={envois.loading || (access.keyring !== null && envois.floods === null)}
        />
      </div>
    );

  if (tab === "demandes")
    return (
      <div className="max-w-4xl space-y-6">
        {header}
        <DemandesPanel view={view} demandes={demandes} sends={envois.sends} loading={envois.loading} />
      </div>
    );

  if (tab === "convoys")
    return (
      <div className="max-w-3xl space-y-6">
        {header}
        <ConvoysPanel
          convoys={envois.convoys}
          refused={envois.refused.convoys}
          members={view.members}
          loading={envois.loading || (access.keyring !== null && envois.convoys === null)}
        />
      </div>
    );

  return (
    <div className="max-w-3xl space-y-6">
      {header}

      {view.leaveProposal && <LeaveProposal view={view} alliance={view.leaveProposal.alliance} />}

      <AccessPanel
        view={view}
        access={access}
        pseudoOf={pseudoOf}
        version={envois.version}
        versionHidden={versionHidden}
      />

      {(isAdmin || view.me.role === "delegate") && keys.pair && (
        <AlertsPanel view={view} access={access} isAdmin={isAdmin} pseudoOf={pseudoOf} absences={absences} />
      )}

      {isAdmin && <RequestsPanel view={view} access={access} canAct={canAct} />}

      <MembersPanel view={view} access={access} canAct={canAct} absences={absences} sends={envois.sends} />

      <Panel title="Inviter">
        <p className="text-muted-foreground">
          Le lien d&apos;invitation mène à cet espace&nbsp;: il ne contient aucun secret. Qui l&apos;ouvre est guidé
          jusqu&apos;à sa demande, que vous verrez ici.
        </p>
        <CopyInvitation spaceId={view.space.id} />
      </Panel>

      {isAdmin && <DiscordPanel view={view} keyring={access.keyring} />}

      <SpaceSettings view={view} />

      <p className="text-sm text-muted-foreground">
        L&apos;état des membres (production, armée, chasses, niveaux et chantiers), leurs floods, leurs convois et leurs
        Demandes sont dans les onglets «&nbsp;État&nbsp;», «&nbsp;Floods&nbsp;», «&nbsp;Convois&nbsp;» et
        «&nbsp;Demandes&nbsp;».
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
    <div className="space-y-3 rounded-lg p-3 ring-1 ring-foreground/10">
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
