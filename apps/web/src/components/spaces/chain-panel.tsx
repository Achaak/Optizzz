"use client";

// « Chaîne » (docs/features/site-chaine.md): the TDC chain's roles of the alliance, the same for every member's
// extension. Admins and Délégués set them; the others read them. Encrypted here with the Clé d'alliance: the site does
// not know who is a granary, a passer or a hunter. A record written before a member's exclusion is encrypted again with
// the newest version when an Admin or a Délégué opens the page.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { formatNumber } from "@optizzz/game/format/number-format";
import { parseNumberField } from "@optizzz/game/format/number-field";
import { formatPastTime } from "@optizzz/game/format/time-format";
import { chainRolesFrom, type ChainRolesRecord } from "@optizzz/game/site-links/chain-roles";
import {
  exportRoles,
  importRoles,
  proposeRoles,
  CHAIN_MARGIN,
  roleKey,
  roleLabel,
  roleOptions as chainRoleOptions,
  roleOrder,
  rungPlaceArrow,
  rungPlaces,
  type Role,
  type RungPlace,
} from "@optizzz/game/tdc-chain/roles";
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import type { AllianceFlood } from "~/lib/envois/floods";
import { passageViewSearch, readPassageView, type PassageView } from "~/lib/spaces/passage";
import { PassagePanel } from "./passage-panel";
import { CopyIcon } from "~/components/icons";
import { Button } from "~/components/ui/button";
import {
  changedMembers,
  formerMembers,
  lockChainRoles,
  openChainRoles,
  rebaseRoles,
  shownRoles,
  staleChainRoles,
  withoutMembers,
  type RosterMember,
} from "~/lib/spaces/chain-roles";
import { askExtensionForChainRoles } from "~/lib/spaces/extension-bridge";
import type { ChainRolesBridgeAnswer } from "@optizzz/game/site-links/space-bridge";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { Callout, FIELD_LABEL, Panel } from "./parts";
import type { MemberView } from "./use-space-access";

const UNREADABLE = "Les rôles de la chaîne ne s'ouvrent pas sur cet appareil. Rechargez la page.";
const OUT: Role = { kind: "out" };

const isConflict = (error: unknown) => (error as { data?: { code?: string } }).data?.code === "CONFLICT";

/** The kind's shape, as on the extension's map: the role reads without telling colours apart (ADR 0003). */
function RoleShape({ role }: { role: Role }) {
  const common = { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": true, className: "shrink-0" } as const;
  switch (role.kind) {
    case "granary":
      return (
        <svg {...common} className="shrink-0 text-primary">
          <rect x="1" y="1" width="10" height="10" fill="currentColor" />
        </svg>
      );
    case "passer":
      return (
        <svg {...common} className="shrink-0 text-info">
          <path d="M6 0 12 6 6 12 0 6Z" fill="currentColor" />
        </svg>
      );
    case "hunter":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="5" fill="currentColor" />
        </svg>
      );
    case "drain":
      return (
        <svg {...common}>
          <path d="M1 1H11L6 11Z" fill="currentColor" />
        </svg>
      );
    case "protected":
      return (
        <svg {...common} className="shrink-0 text-muted-foreground">
          <rect x="1.8" y="1.8" width="8.4" height="8.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "out":
      return (
        <svg {...common} className="shrink-0 text-muted-foreground">
          <path d="M6 1 11 11H1Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
  }
}

/** « ✓ à sa place », or « ↓ plus gros que Lunaire, passeur 1 » (the arrow: where its field must go): in words too, never an arrow alone (ADR 0003). */
function PlaceCell({ place, name }: { place: RungPlace | undefined; name: (id: number) => string }) {
  if (!place) return <span className="text-muted-foreground">—</span>;
  if (place.kind === "ok") return <span className="text-muted-foreground">✓ à sa place</span>;
  return (
    <span>
      <strong aria-hidden="true" className="text-primary">
        {rungPlaceArrow(place.kind)}
      </strong>{" "}
      {place.kind === "up" ? "plus gros que" : "plus petit que"} {name(place.than)}
    </span>
  );
}

/** The saved roles, opened; a record from before a rotation is encrypted again with the newest version. */
function useSavedRoles(view: MemberView, keyring: AllianceKeyring | null, writable: boolean) {
  const stored = view.chainRoles;
  const newest = Math.max(0, ...view.versions);
  const spaceId = view.space.id;
  const { mutateAsync } = api.spaces.saveChainRoles.useMutation();
  const utils = api.useUtils();
  const [opened, setOpened] = useState<{ blob: string | null; record: ChainRolesRecord | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!keyring) return;
    const run = { cancelled: false };
    void (async () => {
      if (!stored) {
        setOpened({ blob: null, record: null });
        return;
      }
      let record: ChainRolesRecord;
      try {
        record = await openChainRoles(stored.blob, spaceId, keyring);
      } catch (error) {
        console.error("[Optizzz] the chain's roles do not open", error);
        if (!run.cancelled) setProblem(UNREADABLE);
        return;
      }
      if (run.cancelled) return;
      setProblem(null);
      setOpened({ blob: stored.blob, record });
      if (!writable || !staleChainRoles(stored.blob, newest)) return;
      // Written before a member's exclusion: encrypted again with the newest version, the roles kept.
      await mutateAsync({
        spaceId,
        blob: await lockChainRoles(record, spaceId, keyring),
        expectedRevision: stored.revision,
      });
      await utils.spaces.view.invalidate({ spaceId });
    })().catch(async (error: unknown) => {
      if (!isConflict(error)) console.error("[Optizzz] the chain's roles could not be encrypted again", error);
      await utils.spaces.view.invalidate({ spaceId });
    });
    return () => {
      run.cancelled = true;
    };
  }, [stored, keyring, writable, newest, spaceId, mutateAsync, utils]);

  async function save(record: ChainRolesRecord, expectedRevision: number): Promise<void> {
    if (!keyring) return;
    await mutateAsync({ spaceId, blob: await lockChainRoles(record, spaceId, keyring), expectedRevision });
    await utils.spaces.view.invalidate({ spaceId });
  }

  /** The newest roles on the site, opened (after a refused save). */
  async function reread(): Promise<{ record: ChainRolesRecord; revision: number } | null> {
    if (!keyring) return null;
    const fresh = await utils.spaces.view.fetch({ spaceId });
    if (fresh.kind !== "member" || !fresh.chainRoles) return null;
    return {
      record: await openChainRoles(fresh.chainRoles.blob, spaceId, keyring),
      revision: fresh.chainRoles.revision,
    };
  }

  const ready = opened !== null && opened.blob === (stored?.blob ?? null);
  return { record: ready ? opened.record : undefined, problem, save, reread };
}

const VIEWS = [
  { value: "roles", label: "Rôles" },
  { value: "plan", label: "Plan de passage" },
] as const;

export function ChainPanel({
  view,
  keyring,
  floods,
  states,
}: {
  view: MemberView;
  keyring: AllianceKeyring | null;
  /** The members' floods on their way and arrived, opened; null until then. */
  floods: AllianceFlood[] | null;
  /** The members' states (field, hunts, army, levels), opened; null until then. */
  states: MemberStates[] | null;
}) {
  const spaceId = view.space.id;
  const canEdit = view.me.role !== "member" && view.me.keyStatus === "current" && keyring !== null;
  const roster = api.spaces.chainRoster.useQuery({ spaceId });
  const saved = useSavedRoles(view, keyring, canEdit);
  const inSpace = useMemo(() => new Set(view.members.map((m) => m.playerId)), [view.members]);
  const pseudos = useMemo(() => view.members.map((m) => m.pseudo), [view.members]);
  const params = useSearchParams();
  const [choice, setChoice] = useState<PassageView>(() => readPassageView(params, pseudos));
  const passage = api.spaces.passageRoster.useQuery({ spaceId }, { enabled: choice.view === "plan" });
  useEffect(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?${passageViewSearch(choice)}`);
  }, [choice]);
  const change = (next: Partial<PassageView>) => setChoice((current) => ({ ...current, ...next }));

  if (!keyring)
    return (
      <Panel title="Chaîne">
        <p className="text-muted-foreground">
          Ouvrez l&apos;accès à l&apos;espace sur cet appareil (onglet «&nbsp;Espace&nbsp;») pour voir les rôles de la
          chaîne de TDC.
        </p>
      </Panel>
    );
  if (saved.problem) return <Callout>{saved.problem}</Callout>;
  if (roster.error) return <Callout>{errorText(roster.error)}</Callout>;
  if (saved.record === undefined || !roster.data) return <p className="text-muted-foreground">Chargement des rôles…</p>;
  const switcher = (
    <div className="space-y-1">
      <span className={FIELD_LABEL}>Vue</span>
      <Segmented label="Vue" options={VIEWS} value={choice.view} onChange={(next) => change({ view: next })} />
    </div>
  );
  if (choice.view === "plan") {
    const me = view.members.find((m) => m.playerId === view.me.playerId)?.pseudo ?? "";
    return (
      <div className="space-y-5">
        {switcher}
        {passage.error ? (
          <Callout>{errorText(passage.error)}</Callout>
        ) : !passage.data ? (
          <p className="text-muted-foreground">Chargement des membres…</p>
        ) : (
          <PassagePanel
            roster={passage.data.members}
            exportAt={passage.data.exportAt}
            roles={shownRoles(roster.data, saved.record).roles}
            keep={new Map(Object.entries(saved.record?.keep ?? {}).map(([id, field]) => [Number(id), field]))}
            floods={floods}
            states={states}
            choice={choice}
            onChange={change}
            me={me}
            server={view.space.server}
            tag={view.space.tag}
          />
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {switcher}
      <ChainEditor
        spaceId={spaceId}
        members={roster.data}
        inSpace={inSpace}
        myId={view.me.playerId}
        saved={saved.record}
        savedLine={view.chainRoles && { at: view.chainRoles.savedAt, by: view.chainRoles.savedBy }}
        canEdit={canEdit}
        save={(record) => saved.save(record, view.chainRoles?.revision ?? 0)}
        reread={async () => (await saved.reread())?.record ?? null}
        takeFromExtension={() => askExtensionForChainRoles(view.space.server, spaceId)}
      />
    </div>
  );
}

interface ChainEditorProps {
  spaceId: string;
  /** The alliance's members, from the export. */
  members: readonly RosterMember[];
  inSpace: ReadonlySet<number>;
  myId: number;
  /** The space's roles, opened; null while none are saved. */
  saved: ChainRolesRecord | null;
  savedLine: { at: Date; by: string } | null;
  /** An Admin or a Délégué whose access is current. */
  canEdit: boolean;
  /** Throws a tRPC CONFLICT when someone saved meanwhile. */
  save: (record: ChainRolesRecord) => Promise<void>;
  /** The newest roles on the site, after a refused save. */
  reread: () => Promise<ChainRolesRecord | null>;
  takeFromExtension: () => Promise<ChainRolesBridgeAnswer | null>;
}

/** The roles, shown to every member and edited by the Admins and Délégués. */
function ChainEditor({
  spaceId,
  members,
  inSpace,
  myId,
  saved,
  savedLine,
  canEdit,
  save,
  reread,
  takeFromExtension: askExtension,
}: ChainEditorProps) {
  // What the editor started from (the saved roles, or the proposed ones), and the roles being edited.
  const [editor, setEditor] = useState<{
    from: ChainRolesRecord;
    base: ChainRolesRecord;
    draft: ChainRolesRecord;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");

  const formerIds = useMemo(() => (saved ? formerMembers(saved, members).map(Number) : []), [saved, members]);
  const formers = api.spaces.formerMembers.useQuery({ spaceId, ids: formerIds }, { enabled: formerIds.length > 0 });
  const proposed = useMemo<ChainRolesRecord>(
    () => ({ roles: Object.fromEntries(shownRoles(members, null).roles), keep: {} }),
    [members],
  );
  const start = saved ?? proposed;
  // Saved roles changed on the site (a save, another editor, a re-encryption): shown as they are, unless being edited.
  const editing = editor !== null && changedMembers(editor.base, editor.draft).length > 0;
  if (editor?.from !== start && !editing) setEditor({ from: start, base: start, draft: start });
  if (!editor) return null;
  const { from, base, draft } = editor;

  const record = saved;
  const { roles, newcomers } = shownRoles(members, draft);
  const former = formerMembers(draft, members);
  // The members whose role changed, and the former members removed from the record.
  const changes = changedMembers(base, draft).filter(
    (id) => members.some((m) => String(m.id) === id) || !former.includes(id),
  );
  const formerName = (id: string) => formers.data?.find((p) => String(p.id) === id)?.pseudo;
  const pseudoOf = (id: string) => members.find((m) => String(m.id) === id)?.pseudo ?? formerName(id) ?? `n° ${id}`;
  const roleOptions = chainRoleOptions(roles.values());
  const places = rungPlaces(roles, new Map(members.map((m) => [m.id, m.field])));
  const placeName = (id: number) => `${pseudoOf(String(id))}, ${roleLabel(roles.get(id) ?? OUT).toLowerCase()}`;
  const ordered = [...members].sort(
    (a, b) => roleOrder(roles.get(b.id) ?? OUT) - roleOrder(roles.get(a.id) ?? OUT) || b.field - a.field,
  );
  const groups = new Map<string, { role: Role; members: RosterMember[] }>();
  for (const member of ordered) {
    const role = roles.get(member.id) ?? OUT;
    const group = groups.get(roleKey(role)) ?? { role, members: [] };
    group.members.push(member);
    groups.set(roleKey(role), group);
  }

  const edit = (change: (current: ChainRolesRecord) => ChainRolesRecord) => {
    setMessage(null);
    setEditor((current) => current && { ...current, draft: change(current.draft) });
  };
  const keepWithout = (keep: Record<string, number>, id: number) =>
    Object.fromEntries(Object.entries(keep).filter(([key]) => key !== String(id)));
  // Only hunters keep a field.
  const setRole = (id: number, role: Role) =>
    edit((current) => ({
      roles: { ...current.roles, [id]: role },
      keep: role.kind === "hunter" ? current.keep : keepWithout(current.keep, id),
    }));
  const setKeep = (id: number, field: number | null) =>
    edit((current) => ({
      ...current,
      keep: field === null ? keepWithout(current.keep, id) : { ...current.keep, [id]: field },
    }));
  const inChain = members.filter((m) => !m.onHoliday && !m.isBanned).map((m) => ({ id: m.id, field: m.field }));

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await save(draft);
      setEditor({ from, base: draft, draft });
    } catch (failure) {
      if (!isConflict(failure)) {
        setError(errorText(failure));
        return;
      }
      // Someone saved meanwhile: my changes put on theirs, to confirm.
      const theirs = await reread().catch(() => null);
      if (!theirs) {
        setError(errorText(failure));
        return;
      }
      setEditor({ from, base: theirs, draft: rebaseRoles(base, draft, theirs) });
      setMessage(
        "D'autres rôles viennent d'être enregistrés : vos changements sont repris par-dessus. Vérifiez-les, puis enregistrez.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function takeFromExtension() {
    setError(null);
    setMessage(null);
    const answer = await askExtension();
    if (!answer || answer.status === "unlinked") {
      setError(
        "Aucune extension liée ne répond dans ce navigateur. Liez-la depuis « Compte Optizzz », puis réessayez.",
      );
      return;
    }
    if (answer.record === null) {
      setMessage("Votre extension n'a pas de rôles choisis : ceux de sa Chaîne sont proposés d'après le TDC.");
      return;
    }
    try {
      const taken = chainRolesFrom(JSON.parse(answer.record), spaceId);
      edit(() => taken);
      setMessage("Rôles repris de votre extension : vérifiez-les, puis enregistrez.");
    } catch {
      setError("Les rôles de votre extension ne se lisent pas : mettez-la à jour.");
    }
  }

  function importText() {
    const { roles: imported, ignored } = importRoles(text, members);
    edit((current) => ({
      ...current,
      roles: { ...current.roles, ...Object.fromEntries(imported) },
    }));
    setMessage(
      `${formatNumber(imported.size)} rôle(s) importé(s).` +
        (ignored.length ? ` Lignes ignorées : ${ignored.join(" · ")}` : ""),
    );
  }

  async function copy() {
    const exported = exportRoles(roles, members);
    try {
      await navigator.clipboard.writeText(exported);
      setMessage("Rôles copiés : collez-les sur Discord.");
    } catch {
      setText(exported);
      setMessage("Copiez le texte ci-dessous.");
    }
  }

  const pending = changes.length > 0 || (record === null && canEdit);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {canEdit && (
          <Button
            variant="outline"
            className="h-9.5 bg-card"
            title="Les plus gros en greniers, puis un échelon par portée de l'échelon du dessus, les plus petits en chasseurs"
            onClick={() =>
              edit((current) => ({ ...current, roles: Object.fromEntries(proposeRoles(inChain, CHAIN_MARGIN)) }))
            }
          >
            Proposer d&apos;après le TDC
          </Button>
        )}
        {canEdit && record === null && (
          <Button variant="outline" className="h-9.5 bg-card" onClick={() => void takeFromExtension()}>
            Reprendre les rôles de votre extension
          </Button>
        )}
        <Button variant="outline" className="h-9.5 gap-1.5 bg-card" onClick={() => void copy()}>
          <CopyIcon width={14} height={14} />
          Copier pour Discord
        </Button>
        <span className="ml-auto text-muted-foreground">
          {savedLine
            ? `Enregistrés ${formatPastTime(savedLine.at, new Date())} par ${savedLine.by}`
            : "Rien d'enregistré : rôles proposés d'après le TDC"}
        </span>
      </div>

      <Callout tone="info">
        Les rôles de la Chaîne de TDC, les mêmes pour toute l&apos;alliance. L&apos;extension de chaque membre de
        l&apos;espace les reprend dans la <strong>Chaîne</strong>, la <strong>Carte</strong> et la colonne{" "}
        <strong>«&nbsp;Rôle&nbsp;»</strong> de la page Membres, à sa prochaine relève.{" "}
        {canEdit ? "Les Admins et les Délégués les changent." : "Seuls les Admins et les Délégués les changent."}
      </Callout>
      {record && newcomers.length > 0 && (
        <Callout tone="warning">
          {newcomers.map((id) => pseudoOf(String(id))).join(", ")}{" "}
          {newcomers.length === 1 ? "est arrivé" : "sont arrivés"} dans l&apos;alliance après l&apos;enregistrement des
          rôles : hors chaîne tant{" "}
          {canEdit ? "que vous ne lui en donnez pas" : "qu'un Admin ou un Délégué ne lui en donne pas"}.
        </Callout>
      )}
      {error && <Callout>{error}</Callout>}
      {message && <Callout tone="info">{message}</Callout>}

      <Panel
        title="Rôles"
        aside={`${formatNumber(members.length)} membres de l'alliance, du plus haut échelon au plus bas`}
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="font-mono text-[0.6875rem] tracking-widest text-muted-foreground uppercase">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Membre
                </th>
                <th scope="col" className="px-2 py-2 text-right font-medium">
                  TDC
                </th>
                <th
                  scope="col"
                  className="px-2 py-2 text-left font-medium"
                  title="Comparé aux échelons voisins, d'après le TDC"
                >
                  Place
                </th>
                <th scope="col" className="px-2 py-2 text-left font-medium">
                  Rôle
                </th>
                <th
                  scope="col"
                  className="px-4 py-2 text-right font-medium"
                  title="Le surplus au-dessus monte vers les greniers"
                >
                  TDC à garder
                </th>
              </tr>
            </thead>
            {[...groups.values()].map((group) => (
              <tbody key={roleKey(group.role)}>
                <tr className="border-t bg-muted">
                  <th
                    scope="rowgroup"
                    colSpan={5}
                    className="px-4 py-1.5 text-left font-mono text-[0.6875rem] tracking-widest uppercase"
                  >
                    <span className="inline-flex items-center gap-2">
                      <RoleShape role={group.role} />
                      {roleLabel(group.role)}
                      <span className="text-muted-foreground">· {formatNumber(group.members.length)}</span>
                    </span>
                  </th>
                </tr>
                {group.members.map((member) => {
                  const role = roles.get(member.id) ?? OUT;
                  const changed = changes.includes(String(member.id));
                  const locked = member.onHoliday || member.isBanned;
                  const notes = [
                    !inSpace.has(member.id) && "hors espace",
                    member.onHoliday && "vacances",
                    member.isBanned && "banni",
                  ].filter(Boolean);
                  return (
                    <tr key={member.id} className="border-t">
                      <th scope="row" className="px-4 py-1.5 text-left font-semibold">
                        {member.pseudo}
                        {member.id === myId && <span className="font-normal text-muted-foreground"> (vous)</span>}
                        {notes.length > 0 && (
                          <span className="font-normal text-muted-foreground"> · {notes.join(", ")}</span>
                        )}
                        {changed && (
                          <span className="ml-2 bg-accent px-1.5 font-mono text-[0.6875rem] font-normal text-primary">
                            modifié
                          </span>
                        )}
                        {record && newcomers.includes(member.id) && (
                          <span className="ml-2 border border-warning-border bg-warning-soft px-1.5 font-mono text-[0.6875rem] font-normal">
                            arrivé depuis
                          </span>
                        )}
                      </th>
                      <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                        {formatNumber(member.field)}
                      </td>
                      <td className="px-2 py-1.5">
                        <PlaceCell place={places.get(member.id)} name={placeName} />
                      </td>
                      <td className="px-2 py-1.5">
                        {canEdit && !locked ? (
                          <select
                            aria-label={`Rôle de ${member.pseudo}`}
                            value={roleKey(role)}
                            onChange={(event) => {
                              const next = roleOptions.find((option) => roleKey(option) === event.target.value);
                              if (next) setRole(member.id, next);
                            }}
                            className={`h-8 min-w-36 border bg-background px-2 ${changed ? "border-primary" : ""}`}
                          >
                            {roleOptions.map((option) => (
                              <option key={roleKey(option)} value={roleKey(option)}>
                                {roleLabel(option)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          roleLabel(role)
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        {role.kind === "drain" ? (
                          <span className="text-muted-foreground">rien : tout monte</span>
                        ) : role.kind !== "hunter" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : canEdit ? (
                          <KeepField
                            key={draft.keep[member.id] ?? "none"}
                            pseudo={member.pseudo}
                            value={draft.keep[member.id] ?? null}
                            onCommit={(field) => setKeep(member.id, field)}
                          />
                        ) : (
                          <span className="font-mono tabular-nums">
                            {draft.keep[member.id] === undefined ? "—" : formatNumber(draft.keep[member.id] ?? 0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          TDC de l&apos;export, relu chaque heure (l&apos;extension prend celui de la page Membres) · vacances et bannis
          hors chaîne d&apos;office · un membre hors de l&apos;espace a quand même un rôle : la chaîne passe aussi par
          lui · « À flooder » : tout son TDC monte vers les greniers · « Ne pas toucher » : il garde son TDC, aucun
          flood de la chaîne · ↓ : plus gros qu&apos;un membre de l&apos;échelon du dessus, à flooder · ↑ : plus petit
          qu&apos;un membre de l&apos;échelon du dessous, doit flooder.
        </p>
      </Panel>

      {former.length > 0 && (
        <Panel
          title="Anciens membres"
          aside={`${formatNumber(former.length)} rôle${former.length > 1 ? "s" : ""} enregistré${former.length > 1 ? "s" : ""}`}
          flush
        >
          <p className="px-4 py-2.5 text-sm text-muted-foreground">
            Partis de l&apos;alliance d&apos;après l&apos;export : leur rôle reste dans l&apos;enregistrement tant
            {canEdit ? " que vous ne le retirez pas" : " qu'un Admin ou un Délégué ne le retire pas"}. Il ne compte plus
            dans la chaîne.
          </p>
          <ul>
            {former.map((id) => {
              const player = formers.data?.find((p) => String(p.id) === id);
              const role = draft.roles[id];
              return (
                <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2">
                  <span className="min-w-0 flex-1">
                    <strong>{player?.pseudo ?? `Joueur n° ${id}`}</strong>
                    {role && <span className="text-muted-foreground"> · {roleLabel(role)}</span>}
                    <span className="block text-xs text-muted-foreground">
                      {player
                        ? player.alliance
                          ? `aujourd'hui dans l'alliance ${player.alliance}`
                          : "aujourd'hui sans alliance"
                        : "absent de l'export du serveur"}
                    </span>
                  </span>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => edit((current) => withoutMembers(current, [id]))}
                    >
                      Retirer
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {canEdit && former.length > 1 && (
            <div className="border-t px-4 py-2.5">
              <Button variant="outline" size="sm" onClick={() => edit((current) => withoutMembers(current, former))}>
                Retirer les {formatNumber(former.length)}
              </Button>
            </div>
          )}
        </Panel>
      )}

      {canEdit && (
        <details className="border bg-card p-4">
          <summary className="cursor-pointer font-medium">Importer un texte</summary>
          <div className="mt-3 space-y-2">
            <label htmlFor="chain-import" className={FIELD_LABEL}>
              Une ligne « Pseudo: rôle » par membre (Grenier 1, Grenier 2…, Passeur 1, Passeur 2…, Chasseur, À flooder,
              Ne pas toucher, Hors chaîne)
            </label>
            <textarea
              id="chain-import"
              rows={5}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={"Noctis: Grenier 1\nOkapi: Passeur 1\nZeph: Chasseur"}
              className="block w-full border bg-background p-2 font-mono text-sm"
            />
            <Button variant="outline" disabled={!text.trim()} onClick={importText}>
              Importer
            </Button>
          </div>
        </details>
      )}

      {canEdit && pending && (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-x-3 gap-y-2 border border-primary bg-card px-4 py-2.5">
          <span className="font-semibold">
            {changes.length === 0
              ? "Rôles proposés, pas encore enregistrés"
              : `${formatNumber(changes.length)} membre${changes.length > 1 ? "s" : ""} modifié${changes.length > 1 ? "s" : ""}`}
          </span>
          <span className="min-w-0 text-muted-foreground">
            {changes
              .slice(0, 4)
              .map((id) => {
                const before = base.roles[id];
                const after = draft.roles[id];
                if (!after && !members.some((m) => String(m.id) === id)) return `${pseudoOf(id)} : retiré`;
                return `${pseudoOf(id)} : ${roleLabel(before ?? OUT)} → ${roleLabel(after ?? OUT)}`;
              })
              .join(" · ")}
            {changes.length > 4 && " …"}
          </span>
          <span className="ml-auto flex gap-2">
            {changes.length > 0 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditor({ from, base, draft: base });
                  setMessage(null);
                }}
              >
                Annuler
              </Button>
            )}
            <Button disabled={busy} onClick={() => void submit()}>
              Enregistrer les rôles
            </Button>
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Rôles chiffrés dans ce navigateur avec la Clé d&apos;alliance : le site ne sait pas qui est grenier, passeur ou
        chasseur.
      </p>
    </div>
  );
}

/** A hunter's field to keep: typed freely, kept when it leaves the field (a new value remounts it). */
function KeepField({
  pseudo,
  value,
  onCommit,
}: {
  pseudo: string;
  value: number | null;
  onCommit: (field: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : formatNumber(value));
  return (
    <input
      aria-label={`TDC à garder par ${pseudo}`}
      inputMode="numeric"
      placeholder="—"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const field = parseNumberField(text.replace(/\s/g, ""), { min: 0, integer: true, allowEmpty: true });
        if (field === undefined) setText(value === null ? "" : formatNumber(value));
        else onCommit(field);
      }}
      className="h-8 w-32 border bg-background px-2 text-right font-mono tabular-nums"
    />
  );
}
