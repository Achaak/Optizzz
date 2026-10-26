// The rules of the Alliance Spaces on the site (docs/features/site-comptes-espaces.md, « Espaces d'alliance » and
// « Confiance et parcours »). The site never sees a Clé d'alliance nor a private key: it keeps what browsers seal and
// sign, checks who may do what, and refuses a certificate that does not come from an Admin of the space acting now.
// Everything that decides whom to believe runs in the browsers (src/lib/spaces/), never here.
import { openCertificate, type Certificate, type CertificateKind } from "@optizzz/crypto/certificate";
import { dataKeyVersion } from "@optizzz/crypto/data";
import { serverById } from "@optizzz/game/servers";
import type { ReminderKind } from "~/lib/spaces/reminders";
import type {
  MemberRow,
  PlayerRef,
  SealedForMember,
  SealedKeyInput,
  SpaceRole,
  SpaceStore,
  SpaceTransaction,
} from "./store";

export class SpaceError extends Error {
  override readonly name = "SpaceError";
  constructor(
    readonly code: "not-found" | "forbidden" | "invalid" | "conflict",
    message: string,
  ) {
    super(message);
  }
}

const PUBLIC_KEY = /^[A-Za-z0-9_-]{43}$/;
/** A private key locked by the passphrase: 97 bytes (ADR 0005, format 2). */
const LOCKED_KEY = /^[A-Za-z0-9_-]{130}$/;
/** A Clé d'alliance sealed and signed for a member: 181 bytes (ADR 0005, format 2). */
const SEALED_KEY = /^[A-Za-z0-9_-]{242}$/;
const TRUST_LIST = /^[A-Za-z0-9_-]{56,1000000}$/;
/** Encrypted alliance data (ADR 0005, format 1): 45 bytes and more. */
const ALLIANCE_DATA = /^[A-Za-z0-9_-]{60,200000}$/;
const SPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_NAME = 60;
const MAX_CERTIFICATES = 50;

const invalid = (message = "Demande incomplète.") => new SpaceError("invalid", message);
const NOT_FOUND = () => new SpaceError("not-found", "Cet espace n'existe pas, ou a été supprimé.");
const NOT_MEMBER = () => new SpaceError("forbidden", "Vous n'êtes pas membre de cet espace.");
const NOT_ADMIN = () => new SpaceError("forbidden", "Seul un Admin de l'espace peut le faire.");
const RELOAD = () => new SpaceError("conflict", "L'espace a changé entre-temps : rechargez la page.");
const KEY_CHANGED = () =>
  new SpaceError(
    "conflict",
    "Un autre Admin vient de changer l'accès à l'espace : rechargez la page, puis recommencez si besoin.",
  );
const BAD_PROOF = () =>
  new SpaceError(
    "invalid",
    "Cette autorisation n'est pas valable : rechargez la page et recommencez. Si cela se reproduit, prévenez-nous.",
  );

const samePlayer = (a: PlayerRef, b: PlayerRef) => a.server === b.server && a.playerId === b.playerId;
const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function checkPublicKey(value: string): void {
  if (!PUBLIC_KEY.test(value)) throw invalid();
}

function checkName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0 || name.length > MAX_NAME)
    throw invalid(`Le nom de l'espace fait de 1 à ${MAX_NAME} caractères.`);
  return name;
}

function checkSealed(sealed: SealedKeyInput[]): void {
  if (
    sealed.length === 0 ||
    sealed.some((s) => !Number.isInteger(s.version) || s.version < 1 || !SEALED_KEY.test(s.sealed))
  )
    throw invalid();
  if (new Set(sealed.map((s) => s.version)).size !== sealed.length) throw invalid();
}

/** Every version of the space, sealed: the history belongs to the alliance. */
function checkAllVersions(sealed: SealedKeyInput[], versions: readonly number[]): void {
  checkSealed(sealed);
  const given = sealed.map((s) => s.version).sort((a, b) => a - b);
  if (given.length !== versions.length || given.some((v, i) => v !== versions[i])) throw RELOAD();
}

/**
 * A certificate or revocation for this space, of the expected kind, signed by `issuer` about `subject`. The signature
 * is checked: the site keeps nothing a browser would throw away.
 */
async function checkCertificate(
  blob: unknown,
  spaceId: string,
  expected: { kinds: CertificateKind[]; issuer: string; subject?: string },
): Promise<Certificate> {
  if (typeof blob !== "string") throw BAD_PROOF();
  let certificate: Certificate;
  try {
    certificate = await openCertificate(blob, spaceId);
  } catch {
    throw BAD_PROOF();
  }
  if (
    !expected.kinds.includes(certificate.kind) ||
    certificate.issuer !== expected.issuer ||
    (expected.subject !== undefined && certificate.subject !== expected.subject)
  )
    throw BAD_PROOF();
  return certificate;
}

/** Whether the member's boxes were sealed for the account's key today (not after a forgotten passphrase). */
const sealedForToday = (member: MemberRow) => member.sealedFor === member.currentKey;

/**
 * « à jour », or « à renvoyer »: a key changed since (passphrase forgotten), a version of the Clé d'alliance missing
 * (a new version sealed after an exclusion by an Admin who did not believe this member's key), or every version left
 * unsealed again at an Admin's withdrawal for the same reason (`resendNeeded`).
 */
const keyStatus = (member: MemberRow, versions: readonly number[]) =>
  sealedForToday(member) && !member.resendNeeded && versions.every((v) => member.versions.includes(v))
    ? ("current" as const)
    : ("resend" as const);

/**
 * The acting person's membership; with `admin`, an Admin whose access is up to date (they sign with that key); with
 * `alerts`, an Admin or a Délégué whose access is up to date (they encrypt with the newest version).
 */
function actor(
  members: MemberRow[],
  versions: readonly number[],
  userId: string,
  { admin, alerts = false }: { admin: boolean; alerts?: boolean },
): MemberRow {
  const me = members.find((m) => m.userId === userId);
  if (!me) throw NOT_MEMBER();
  if (admin && me.role !== "admin") throw NOT_ADMIN();
  if (alerts && me.role === "member")
    throw new SpaceError("forbidden", "Seul un Admin ou un Délégué de l'espace peut le faire.");
  if ((admin || alerts) && keyStatus(me, versions) !== "current")
    throw new SpaceError("forbidden", "Votre accès à l'espace doit d'abord vous être renvoyé par un autre Admin.");
  return me;
}

const adminCount = (members: MemberRow[]) => members.filter((m) => m.role === "admin").length;

/**
 * Asks for the site's reminder on Discord (src/server/reminders/service.ts): it posts later, if an Admin switched the
 * kind on, and never fails the action.
 */
type Remind = (spaceId: string, kind: ReminderKind) => void;

export function spaceService(store: SpaceStore, now: () => Date = () => new Date(), remind: Remind = () => undefined) {
  async function inExistingSpace<T>(spaceId: string, work: (tx: SpaceTransaction) => Promise<T>): Promise<T> {
    if (!SPACE_ID.test(spaceId)) throw NOT_FOUND();
    return store.inSpace(spaceId, async (tx) => {
      if (!(await tx.space())) throw NOT_FOUND();
      return work(tx);
    });
  }

  async function ownPlayer(userId: string, player: PlayerRef) {
    const found = (await store.playersOf(userId)).find((p) => samePlayer(p, player));
    if (!found) throw new SpaceError("forbidden", "Ce Joueur n'est pas rattaché à votre Compte Optizzz.");
    return found;
  }

  return {
    /** The account's key pair (locked) and trust list, or null before a first passphrase. */
    key: (userId: string) => store.key(userId),

    async createKey(userId: string, input: { publicKey: string; lockedPrivateKey: string }) {
      checkPublicKey(input.publicKey);
      if (!LOCKED_KEY.test(input.lockedPrivateKey)) throw invalid();
      if ((await store.createKey(userId, input.publicKey, input.lockedPrivateKey)) === "exists")
        throw new SpaceError("conflict", "Votre compte a déjà une phrase secrète : rechargez la page.");
    },

    async changePassphrase(userId: string, input: { publicKey: string; lockedPrivateKey: string }) {
      checkPublicKey(input.publicKey);
      if (!LOCKED_KEY.test(input.lockedPrivateKey)) throw invalid();
      if (!(await store.relockKey(userId, input.publicKey, input.lockedPrivateKey))) throw RELOAD();
    },

    async forgetPassphrase(userId: string, input: { publicKey: string; lockedPrivateKey: string }) {
      checkPublicKey(input.publicKey);
      if (!LOCKED_KEY.test(input.lockedPrivateKey)) throw invalid();
      await store.resetKey(userId, input.publicKey, input.lockedPrivateKey);
    },

    async saveTrustList(userId: string, input: { trustList: string; expectedRevision: number }) {
      if (!TRUST_LIST.test(input.trustList) || !Number.isInteger(input.expectedRevision)) throw invalid();
      if (!(await store.key(userId))) throw invalid();
      const revision = await store.saveTrustList(userId, input.trustList, input.expectedRevision);
      if (revision === null) throw new SpaceError("conflict", "trust-list-conflict");
      return { revision };
    },

    /** /spaces: for each Player of the account, its space, its requests and the spaces of its alliance. */
    async overview(userId: string) {
      const [key, linked, players, memberships, requests] = await Promise.all([
        store.key(userId),
        store.extensionLinked(userId),
        store.playersOf(userId),
        store.membershipsOf(userId),
        store.requestsOf(userId),
      ]);
      return {
        hasKey: key !== null,
        extensionLinked: linked,
        players: await Promise.all(
          players.map(async (player) => {
            const inExport = await store.exportAlliance(player);
            const alliance = inExport ?? null;
            const membership = memberships.find((m) => samePlayer(m, player)) ?? null;
            return {
              ...player,
              alliance,
              membership: membership && {
                spaceId: membership.spaceId,
                name: membership.spaceName,
                role: membership.role,
                keyStatus: membership.sealedFor === key?.publicKey && !membership.resendNeeded ? "current" : "resend",
                // The export says the Player left the space's alliance: offered to leave the space.
                leftAlliance: inExport !== undefined && (inExport === null || !sameTag(inExport, membership.spaceTag)),
              },
              requests: requests
                .filter((r) => samePlayer(r, player))
                .map(({ spaceId, spaceName, status, createdAt, decidedAt }) => ({
                  spaceId,
                  name: spaceName,
                  status,
                  createdAt,
                  decidedAt,
                })),
              joinable: alliance && !membership ? await store.spacesOfAlliance(player.server, alliance) : [],
            };
          }),
        ),
      };
    },

    /**
     * « Créer un espace »: the creator's browser drew the id and the first Clé d'alliance, sealed for itself and signed;
     * the tag comes from the export, never from the request.
     */
    async createSpace(
      userId: string,
      input: { id: string; server: string; playerId: number; name?: string; sealed: SealedKeyInput[] },
    ) {
      const server = serverById(input.server);
      if (!SPACE_ID.test(input.id) || server?.id !== input.server) throw invalid();
      const player = await ownPlayer(userId, input);
      const key = await store.key(userId);
      if (!key) throw invalid("Choisissez d'abord la phrase secrète de votre compte.");
      checkSealed(input.sealed);
      if (input.sealed.length !== 1 || input.sealed[0]?.version !== 1) throw invalid();
      const tag = await store.exportAlliance(player);
      if (!tag)
        throw invalid(`${player.pseudo} n'est dans aucune alliance d'après l'export public du serveur ${server.name}.`);
      const name = checkName(input.name ?? `${tag} sur ${server.name}`);
      const created = await store.createSpace(
        { id: input.id, server: server.id, tag, name },
        { server: player.server, playerId: player.playerId, publicKey: key.publicKey, pseudo: player.pseudo },
        input.sealed,
      );
      if (created === "taken")
        throw new SpaceError("conflict", `${player.pseudo} est déjà dans un espace : quittez-le d'abord.`);
      return { id: input.id };
    },

    /** A space as its member sees it, or as an invited person sees it (the steps left before asking to join). */
    async view(userId: string, spaceId: string) {
      const summary = SPACE_ID.test(spaceId) ? await store.spaceSummary(spaceId) : null;
      if (!summary) throw NOT_FOUND();
      return inExistingSpace(spaceId, async (tx) => {
        const [space, members, versions] = await Promise.all([tx.space(), tx.members(), tx.versions()]);
        if (!space) throw NOT_FOUND();
        const me = members.find((m) => m.userId === userId);
        if (me) {
          const isAdmin = me.role === "admin";
          const [requests, certificates, sealed, absenceAlerts, alliance, discord] = await Promise.all([
            isAdmin ? tx.requests() : Promise.resolve([]),
            tx.certificates(),
            // Still the older versions while a newer one waits to be sent: older data stays readable.
            sealedForToday(me) ? tx.sealedFor(me) : Promise.resolve([]),
            me.role === "member" ? Promise.resolve(null) : tx.absenceAlerts(),
            store.exportAlliance(me),
            isAdmin ? tx.discord() : Promise.resolve(null),
          ]);
          return {
            kind: "member" as const,
            space,
            me: {
              server: me.server,
              playerId: me.playerId,
              pseudo: me.pseudo,
              role: me.role,
              keyStatus: keyStatus(me, versions),
            },
            // The export says the Player left the space's alliance: they are offered to leave the space.
            leaveProposal:
              alliance === undefined || (alliance !== null && sameTag(alliance, space.tag)) ? null : { alliance },
            members: members.map((m) => ({
              server: m.server,
              playerId: m.playerId,
              pseudo: m.pseudo,
              role: m.role,
              joinedAt: m.joinedAt,
              publicKey: m.currentKey,
              sealedFor: m.sealedFor,
              keyStatus: keyStatus(m, versions),
              isMe: m.userId === userId,
            })),
            requests: requests.map((r) => ({
              id: r.id,
              playerId: r.playerId,
              pseudo: r.pseudo,
              status: r.status,
              createdAt: r.createdAt,
              decidedAt: r.decidedAt,
              publicKey: r.currentKey,
            })),
            versions,
            sealed,
            certificates,
            /** Admins and Délégués only: encrypted with the Clé d'alliance (src/lib/spaces/absences.ts). */
            absenceAlerts,
            /**
             * Admins only: the Discord webhook encrypted with the Clé d'alliance (src/lib/spaces/discord.ts), and the
             * last refusal a member's extension reported for this save.
             */
            discord: discord && {
              blob: discord.blob,
              revision: discord.revision,
              refusal:
                discord.refusal?.revision === discord.revision
                  ? { status: discord.refusal.status, at: discord.refusal.at, pseudo: discord.refusal.pseudo }
                  : null,
            },
          };
        }
        const [key, linked, players, requests] = await Promise.all([
          store.key(userId),
          store.extensionLinked(userId),
          store.playersOf(userId),
          tx.requests(),
        ]);
        const player = players.find((p) => p.server === space.server) ?? null;
        const alliance = player ? ((await store.exportAlliance(player)) ?? null) : null;
        const request = player ? (requests.find((r) => samePlayer(r, player)) ?? null) : null;
        const otherSpace = player ? await tx.spaceOfPlayer(player) : null;
        return {
          kind: "invitation" as const,
          space: summary,
          linked,
          hasKey: key !== null,
          player: player && { ...player, alliance, inAlliance: alliance !== null && sameTag(alliance, space.tag) },
          inOtherSpace: otherSpace !== null && otherSpace !== spaceId,
          request: request && { status: request.status, createdAt: request.createdAt, decidedAt: request.decidedAt },
          // For the Code de sécurité, once the request is made: whom to exchange it with.
          admins:
            request?.status === "pending"
              ? members
                  .filter((m) => m.role === "admin" && keyStatus(m, versions) === "current")
                  .map((m) => ({ pseudo: m.pseudo, publicKey: m.sealedFor }))
              : [],
        };
      });
    },

    /**
     * « Demander à rejoindre »: one request per space and Player, for a Player of the space's alliance. A new pending
     * request asks for the reminder « Nouvelle demande pour rejoindre l'espace … » (content-free).
     */
    async requestToJoin(userId: string, input: { spaceId: string; playerId: number }) {
      if (!(await store.key(userId))) throw invalid("Choisissez d'abord la phrase secrète de votre compte.");
      const asked = await inExistingSpace(input.spaceId, async (tx) => {
        const space = await tx.space();
        if (!space) throw NOT_FOUND();
        const player = await ownPlayer(userId, { server: space.server, playerId: input.playerId });
        const alliance = await store.exportAlliance(player);
        if (!alliance || !sameTag(alliance, space.tag))
          throw invalid(`${player.pseudo} n'est pas dans l'alliance ${space.tag} d'après l'export public.`);
        if (await tx.spaceOfPlayer(player))
          throw new SpaceError("conflict", `${player.pseudo} est déjà dans un espace : quittez-le d'abord.`);
        const existing = (await tx.requests()).find((r) => samePlayer(r, player));
        if (existing?.status === "pending") return false;
        await tx.putRequest(player, now());
        return true;
      });
      if (asked) remind(input.spaceId, "join-requests");
    },

    async cancelRequest(userId: string, input: { spaceId: string }) {
      await inExistingSpace(input.spaceId, async (tx) => {
        const mine = (await tx.requests()).filter((r) => r.userId === userId && r.status === "pending");
        for (const request of mine) await tx.deleteRequest(request.id);
      });
    },

    /**
     * « Donner l'accès »: the Admin's browser compared the Code de sécurité, found the pseudo on the game's Members page,
     * sealed every version for the newcomer's key and signed a member certificate.
     */
    async approve(
      userId: string,
      input: { spaceId: string; requestId: string; publicKey: string; sealed: SealedKeyInput[]; certificate: string },
    ) {
      checkPublicKey(input.publicKey);
      await inExistingSpace(input.spaceId, async (tx) => {
        const [members, versions] = await Promise.all([tx.members(), tx.versions()]);
        const me = actor(members, versions, userId, { admin: true });
        const request = (await tx.requests()).find((r) => r.id === input.requestId && r.status === "pending");
        if (!request) throw RELOAD();
        if (request.currentKey !== input.publicKey) throw RELOAD();
        if (await tx.spaceOfPlayer(request))
          throw new SpaceError("conflict", `${request.pseudo} est déjà dans un espace.`);
        checkAllVersions(input.sealed, versions);
        await checkCertificate(input.certificate, input.spaceId, {
          kinds: ["member"],
          issuer: me.sealedFor,
          subject: input.publicKey,
        });
        await tx.deleteRequest(request.id);
        await tx.addMember(
          { server: request.server, playerId: request.playerId, role: "member", publicKey: input.publicKey },
          input.sealed,
        );
        await tx.addCertificates([input.certificate]);
      });
    },

    async refuse(userId: string, input: { spaceId: string; requestId: string }) {
      await inExistingSpace(input.spaceId, async (tx) => {
        actor(await tx.members(), await tx.versions(), userId, { admin: true });
        const request = (await tx.requests()).find((r) => r.id === input.requestId && r.status === "pending");
        if (request) await tx.refuseRequest(request.id, now());
      });
    },

    /** « Clé à renvoyer »: the same path as an approval, for a member whose passphrase was forgotten. */
    async resend(
      userId: string,
      input: { spaceId: string; playerId: number; publicKey: string; sealed: SealedKeyInput[]; certificate: string },
    ) {
      checkPublicKey(input.publicKey);
      await inExistingSpace(input.spaceId, async (tx) => {
        const [members, versions] = await Promise.all([tx.members(), tx.versions()]);
        const me = actor(members, versions, userId, { admin: true });
        const member = members.find((m) => m.playerId === input.playerId);
        if (!member || keyStatus(member, versions) !== "resend" || member.currentKey !== input.publicKey)
          throw RELOAD();
        checkAllVersions(input.sealed, versions);
        await checkCertificate(input.certificate, input.spaceId, {
          kinds: [member.role === "admin" ? "admin" : "member"],
          issuer: me.sealedFor,
          subject: input.publicKey,
        });
        await tx.sealFor(member, input.publicKey, input.sealed);
        await tx.addCertificates([input.certificate]);
      });
    },

    /**
     * Name an Admin (with an Admin certificate by the acting Admin), or name or withdraw a Délégué. Withdrawing an
     * Admin seals the Clé d'alliance again: `withdrawAdmin`.
     */
    async setRole(userId: string, input: { spaceId: string; playerId: number; role: SpaceRole; certificate?: string }) {
      if (!["admin", "delegate", "member"].includes(input.role)) throw invalid();
      await inExistingSpace(input.spaceId, async (tx) => {
        const [members, versions] = await Promise.all([tx.members(), tx.versions()]);
        const me = actor(members, versions, userId, { admin: true });
        const target = members.find((m) => m.playerId === input.playerId);
        if (!target) throw RELOAD();
        if (target.role === input.role) return;
        // An Admin is withdrawn with every version sealed again: `withdrawAdmin`.
        if (target.role === "admin") throw invalid();
        if (input.role === "admin") {
          if (keyStatus(target, versions) !== "current")
            throw invalid(`L'accès de ${target.pseudo} doit d'abord lui être renvoyé.`);
          await checkCertificate(input.certificate, input.spaceId, {
            kinds: ["admin"],
            issuer: me.sealedFor,
            subject: target.sealedFor,
          });
        }
        await tx.setRole(target, input.role);
        if (input.certificate !== undefined && input.role === "admin") await tx.addCertificates([input.certificate]);
      });
    },

    /**
     * « Retirer Admin » (ticket 18b): the Admin becomes a member. The acting Admin's browser signed the revocation,
     * signed again the certificates that stop counting with it, and sealed every version of the Clé d'alliance again for
     * the members it believes, itself included (src/lib/spaces/access.ts, `withdrawAdmin`): their boxes are replaced,
     * since those the withdrawn Admin had sealed stop opening. The members it did not believe keep their boxes,
     * « à renvoyer ». No new version. Never the last Admin, never oneself (one cannot revoke oneself).
     */
    async withdrawAdmin(
      userId: string,
      input: {
        spaceId: string;
        playerId: number;
        revocation: string;
        certificates: string[];
        sealed: SealedForMember[];
      },
    ) {
      await inExistingSpace(input.spaceId, async (tx) => {
        const [members, versions] = await Promise.all([tx.members(), tx.versions()]);
        const me = actor(members, versions, userId, { admin: true });
        const target = members.find((m) => m.playerId === input.playerId);
        if (target?.role !== "admin") throw RELOAD();
        if (target.userId === userId) throw invalid("Demandez à un autre Admin de vous retirer ce rôle.");
        if (adminCount(members) <= 1) throw invalid("Le dernier Admin de l'espace ne peut pas être retiré.");
        await checkCertificate(input.revocation, input.spaceId, {
          kinds: ["admin-revocation"],
          issuer: me.sealedFor,
          subject: target.sealedFor,
        });
        await checkGrants(input.certificates, input.spaceId, me.sealedFor, members);
        checkResealed(input.sealed, members, versions, versions, me);
        await tx.setRole(target, "member");
        await reseal(tx, input.sealed, members);
        for (const member of members) {
          const left = !input.sealed.some((s) => s.playerId === member.playerId);
          if (left && keyStatus(member, versions) === "current") await tx.askResend(member);
        }
        await tx.addCertificates([input.revocation, ...input.certificates]);
      });
    },

    /**
     * Certificates an Admin's browser signs on its own (a new Admin certifying the Admins it believes, a changed key
     * certified again after the Code de sécurité): member and Admin
     * certificates only, by the acting Admin, about members of the space.
     */
    async addCertificates(userId: string, input: { spaceId: string; certificates: string[] }) {
      await inExistingSpace(input.spaceId, async (tx) => {
        const members = await tx.members();
        const me = actor(members, await tx.versions(), userId, { admin: true });
        await checkGrants(input.certificates, input.spaceId, me.sealedFor, members);
        if (input.certificates.length > 0) await tx.addCertificates(input.certificates);
      });
    },

    /**
     * « Exclure » (ticket 18): the access is cut at once (membership and boxes deleted). The acting Admin's browser
     * signed the exclusion, signed again the certificates that stop counting with it, and sealed every version of the
     * Clé d'alliance, a new one included, for the remaining members it believes, itself included (their boxes are
     * replaced; the others keep theirs, without the new version, « à renvoyer »). One version N per space: a version
     * that is not the next number (another Admin changed the key meanwhile) is refused, and the database refuses a
     * second row of the same number (src/server/spaces/prisma-store.ts, `alliance_key_version`).
     */
    async exclude(
      userId: string,
      input: {
        spaceId: string;
        playerId: number;
        exclusion: string;
        certificates: string[];
        version: number;
        sealed: SealedForMember[];
      },
    ) {
      await inExistingSpace(input.spaceId, async (tx) => {
        const [members, versions] = await Promise.all([tx.members(), tx.versions()]);
        const me = actor(members, versions, userId, { admin: true });
        const target = members.find((m) => m.playerId === input.playerId);
        if (!target) throw RELOAD();
        if (target.userId === userId) throw invalid("Pour partir de l'espace, utilisez « Quitter ».");
        await checkCertificate(input.exclusion, input.spaceId, {
          kinds: ["exclusion"],
          issuer: me.sealedFor,
          subject: target.sealedFor,
        });
        const remaining = members.filter((m) => m !== target);
        await checkGrants(input.certificates, input.spaceId, me.sealedFor, remaining);
        if (input.version !== Math.max(0, ...versions) + 1) throw KEY_CHANGED();
        checkResealed(input.sealed, remaining, [...versions, input.version], versions, me);
        if ((await tx.addVersion(input.version, me.pseudo)) === "taken") throw KEY_CHANGED();
        await tx.removeMember(target);
        await reseal(tx, input.sealed, remaining);
        await tx.addCertificates([input.exclusion, ...input.certificates]);
      });
    },

    /**
     * The absence alerts, encrypted in an Admin's or a Délégué's browser with the newest version: written if the
     * revision is still the one they read (0 when there are none yet).
     */
    async saveAbsenceAlerts(userId: string, input: { spaceId: string; blob: string; expectedRevision: number }) {
      if (!ALLIANCE_DATA.test(input.blob) || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0)
        throw invalid();
      return inExistingSpace(input.spaceId, async (tx) => {
        actor(await tx.members(), await tx.versions(), userId, { admin: false, alerts: true });
        const revision = await tx.saveAbsenceAlerts(input.blob, input.expectedRevision);
        if (revision === null) throw RELOAD();
        return { revision };
      });
    },

    /**
     * The Discord webhook and its events (docs/features/site-discord.md), encrypted in an Admin's browser with the
     * newest version of the Clé d'alliance: written if the revision is still the one they read (0 when there is none
     * yet). A refusal reported for the previous save is forgotten.
     */
    async saveDiscord(userId: string, input: { spaceId: string; blob: string; expectedRevision: number }) {
      if (!ALLIANCE_DATA.test(input.blob) || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0)
        throw invalid();
      return inExistingSpace(input.spaceId, async (tx) => {
        const versions = await tx.versions();
        actor(await tx.members(), versions, userId, { admin: true });
        if (dataKeyVersion(input.blob) !== Math.max(0, ...versions)) throw KEY_CHANGED();
        const revision = await tx.saveDiscord(input.blob, input.expectedRevision);
        if (revision === null) throw RELOAD();
        return { revision };
      });
    },

    /**
     * For the extension of a member (any member: the message leaves from the one who acts): the webhook of each of the
     * account's spaces that has one, still encrypted.
     */
    async discordForExtension(userId: string) {
      const spaceIds = [...new Set((await store.membershipsOf(userId)).map((m) => m.spaceId))];
      const rows = await Promise.all(
        spaceIds.map((spaceId) =>
          inExistingSpace(spaceId, async (tx) => {
            const row = await tx.discord();
            return row && { spaceId, blob: row.blob, revision: row.revision };
          }),
        ),
      );
      return rows.filter((row) => row !== null);
    },

    /**
     * A member's extension says Discord refused a message (a 4xx other than a rate limit: the webhook was deleted, or
     * its address is wrong): the Admins see it on the space page until the webhook is saved again. Nothing of the
     * message comes with it. A report about an older save is ignored.
     */
    async reportDiscordRefusal(userId: string, input: { spaceId: string; revision: number; status: number }) {
      const { revision, status } = input;
      if (!Number.isInteger(revision) || !Number.isInteger(status) || status < 400 || status > 499 || status === 429)
        throw invalid();
      await inExistingSpace(input.spaceId, async (tx) => {
        const me = actor(await tx.members(), [], userId, { admin: false });
        await tx.reportDiscordRefusal(revision, { status, at: now(), pseudo: me.pseudo });
      });
    },

    /** « Quitter »: the last Admin names someone first, unless alone: the space then goes with them. */
    async leave(userId: string, input: { spaceId: string }) {
      return inExistingSpace(input.spaceId, async (tx) => {
        const members = await tx.members();
        const me = actor(members, [], userId, { admin: false });
        if (members.length === 1) {
          await tx.deleteSpace();
          return { deleted: true };
        }
        if (me.role === "admin" && adminCount(members) === 1)
          throw invalid("Nommez un autre Admin avant de quitter l'espace.");
        await tx.removeMember(me);
        return { deleted: false };
      });
    },

    async rename(userId: string, input: { spaceId: string; name: string }) {
      const name = checkName(input.name);
      await inExistingSpace(input.spaceId, async (tx) => {
        actor(await tx.members(), await tx.versions(), userId, { admin: true });
        await tx.rename(name);
      });
    },

    /** « Supprimer l'espace », by an Admin who typed its name: everything goes, sealed keys included. */
    async deleteSpace(userId: string, input: { spaceId: string; name: string }) {
      await inExistingSpace(input.spaceId, async (tx) => {
        const space = await tx.space();
        const me = (await tx.members()).find((m) => m.userId === userId);
        if (!me) throw NOT_MEMBER();
        if (me.role !== "admin") throw NOT_ADMIN();
        if (space?.name !== input.name.trim()) throw invalid("Tapez le nom exact de l'espace pour le supprimer.");
        await tx.deleteSpace();
      });
    },
  };
}

/**
 * After an exclusion or an Admin's withdrawal: every version (`versions`, a new one included after an exclusion)
 * sealed for distinct remaining members whose access was up to date with the versions the space had (`held`: sealed for
 * their key today, every one held), the acting Admin among them. Which members the acting Admin believes is decided in
 * its browser; the site cannot open the boxes either: their signature is for the members to check.
 */
function checkResealed(
  sealed: SealedForMember[],
  remaining: MemberRow[],
  versions: readonly number[],
  held: readonly number[],
  me: MemberRow,
): void {
  if (sealed.length === 0 || sealed.length > remaining.length) throw invalid();
  if (new Set(sealed.map((s) => s.playerId)).size !== sealed.length) throw invalid();
  for (const entry of sealed) {
    if (!Number.isInteger(entry.playerId)) throw invalid();
    checkAllVersions(entry.sealed, versions);
    const member = remaining.find((m) => m.playerId === entry.playerId);
    if (!member || keyStatus(member, held) !== "current") throw RELOAD();
  }
  if (!sealed.some((s) => s.playerId === me.playerId)) throw invalid();
}

/** Replaces the boxes of each member sealed again (`checkResealed`), for the key they were sealed for. */
async function reseal(tx: SpaceTransaction, sealed: SealedForMember[], remaining: MemberRow[]): Promise<void> {
  for (const entry of sealed) {
    const member = remaining.find((m) => m.playerId === entry.playerId);
    if (member) await tx.sealFor(member, member.sealedFor, entry.sealed);
  }
}

/** Member and Admin certificates by `issuer`, each about a member's key (an Admin's, for an Admin certificate). */
async function checkGrants(blobs: unknown[], spaceId: string, issuer: string, members: MemberRow[]): Promise<void> {
  if (blobs.length > MAX_CERTIFICATES) throw invalid();
  for (const blob of blobs) {
    const certificate = await checkCertificate(blob, spaceId, { kinds: ["member", "admin"], issuer });
    const subject = members.find((m) => m.currentKey === certificate.subject && m.sealedFor === certificate.subject);
    if (!subject) throw BAD_PROOF();
  }
}

/** Why an account cannot be deleted now: the last Admin of a space with other members. */
export function lastAdminBlocker(
  memberships: { spaceName: string; role: SpaceRole; admins: number; members: number }[],
) {
  const blocking = memberships.find((m) => m.role === "admin" && m.admins === 1 && m.members > 1);
  return blocking ? `Nommez un autre Admin de ${blocking.spaceName} d'abord.` : null;
}

export type SpaceView = Awaited<ReturnType<ReturnType<typeof spaceService>["view"]>>;
export type SpacesOverview = Awaited<ReturnType<ReturnType<typeof spaceService>["overview"]>>;
