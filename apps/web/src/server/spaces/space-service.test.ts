// The Alliance Spaces end to end: the browsers' steps (src/lib/spaces/access.ts, real libsodium) against the site's
// rules, on the store in memory.
import { encryptData, decryptData } from "@optizzz/crypto/data";
import { generateKeyPair, type KeyPair } from "@optizzz/crypto/personal-key";
import { openCertificate, signCertificate } from "@optizzz/crypto/certificate";
import { CryptoError } from "@optizzz/crypto/errors";
import type { SpaceTrust } from "@optizzz/crypto/trust";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  certify,
  excludeMember,
  grantAccess,
  newSpace,
  openSpace,
  trustedIn,
  withdrawAdmin,
} from "~/lib/spaces/access";
import { memoryStore } from "./memory-store";
import { SpaceError, lastAdminBlocker, spaceService, type SpaceView } from "./space-service";

const LOCKED = "A".repeat(130);
const NOW = Date.parse("2026-10-25T10:00:00Z");

type Member = Extract<SpaceView, { kind: "member" }>;
type Invitation = Extract<SpaceView, { kind: "invitation" }>;

interface Person {
  userId: string;
  pair: KeyPair;
  playerId: number;
  pseudo: string;
  /** What this person's browser knows: its trust list for the space. */
  trust: SpaceTrust;
}

let memory: ReturnType<typeof memoryStore>;
let service: ReturnType<typeof spaceService>;
let spaceId: string;
/** The site's reminders on Discord asked for: [space, kind]. */
let reminders: [string, string][];

async function person(
  userId: string,
  playerId: number,
  pseudo: string,
  alliance: string | null = "ABC",
): Promise<Person> {
  const pair = await generateKeyPair();
  memory.addPlayer(userId, { server: "s5", playerId, pseudo, alliance });
  memory.link(userId);
  await service.createKey(userId, { publicKey: pair.publicKey, lockedPrivateKey: LOCKED });
  return { userId, pair, playerId, pseudo, trust: { spaceId: "", verified: [], certificates: [] } };
}

const memberView = async (who: Person) => {
  const view = await service.view(who.userId, spaceId);
  if (view.kind !== "member") throw new Error("not a member");
  return view;
};

/** What the person's browser knows of the space: its own list, and the site's certificates. */
const knowledge = (who: Person, view: Member): SpaceTrust => ({
  spaceId,
  verified: who.trust.verified,
  certificates: [...new Set([...who.trust.certificates, ...view.certificates])],
});

/** Both browsers saw matching Codes de sécurité: each puts the other's key in its trust list. */
function exchangeCodes(admin: Person, other: Person) {
  admin.trust.verified.push({ publicKey: other.pair.publicKey, role: "member", verifiedAt: NOW });
  other.trust.verified.push({ publicKey: admin.pair.publicKey, role: "admin", verifiedAt: NOW });
}

async function create(creator: Person) {
  spaceId = randomUUID();
  const { sealed, root } = await newSpace(creator.pair, spaceId, NOW);
  creator.trust = { spaceId, verified: [root], certificates: [] };
  await service.createSpace(creator.userId, { id: spaceId, server: "s5", playerId: creator.playerId, sealed });
}

async function keyringOf(who: Person) {
  const view = await memberView(who);
  return openSpace(who.pair, view.sealed, knowledge(who, view));
}

/** « Donner l'accès » after the codes matched (the Members page check is the page's: members-check.ts). */
async function approve(admin: Person, newcomer: Person, now = NOW) {
  newcomer.trust = { spaceId, verified: newcomer.trust.verified, certificates: [] };
  exchangeCodes(admin, newcomer);
  const view = await memberView(admin);
  const request = view.requests.find((r) => r.playerId === newcomer.playerId && r.status === "pending");
  if (!request?.publicKey) throw new Error("no request");
  const keyring = await keyringOf(admin);
  const { sealed, certificate } = await grantAccess({
    me: admin.pair,
    keyring,
    recipient: request.publicKey,
    trust: knowledge(admin, view),
    now,
  });
  admin.trust.certificates.push(certificate);
  await service.approve(admin.userId, {
    spaceId,
    requestId: request.id,
    publicKey: request.publicKey,
    sealed,
    certificate,
  });
}

async function join(admin: Person, newcomer: Person, now = NOW) {
  await service.requestToJoin(newcomer.userId, { spaceId, playerId: newcomer.playerId });
  await approve(admin, newcomer, now);
}

async function nameAdmin(admin: Person, other: Person) {
  const view = await memberView(admin);
  const certificate = await certify({
    me: admin.pair,
    subject: other.pair.publicKey,
    kind: "admin",
    trust: knowledge(admin, view),
    now: NOW + 1000,
  });
  await service.setRole(admin.userId, { spaceId, playerId: other.playerId, role: "admin", certificate });
}

let alice: Person;
let bruno: Person;
let chloe: Person;

beforeEach(async () => {
  memory = memoryStore();
  reminders = [];
  service = spaceService(
    memory.store,
    () => new Date(NOW),
    (id, kind) => reminders.push([id, kind]),
  );
  alice = await person("alice", 1, "Alice");
  bruno = await person("bruno", 2, "Bruno");
  chloe = await person("chloe", 3, "Chloe");
});

describe("creating a space", () => {
  it("makes the creator its Admin, with a Clé d'alliance only their browser can open", async () => {
    await create(alice);
    const view = await memberView(alice);
    expect(view.space).toMatchObject({ server: "s5", tag: "ABC", name: "ABC sur S5" });
    expect(view.me).toMatchObject({ role: "admin", keyStatus: "current" });
    // The site holds a sealed box, never the key.
    expect(view.sealed).toHaveLength(1);
    expect(view.sealed[0]?.sealed).toMatch(/^[A-Za-z0-9_-]{242}$/);
    const keyring = await keyringOf(alice);
    expect(keyring.map((k) => k.version)).toEqual([1]);
  });

  it("takes the tag from the export, and refuses a Player without alliance", async () => {
    const loner = await person("dan", 4, "Dan", null);
    const { sealed } = await newSpace(loner.pair, randomUUID(), NOW);
    await expect(service.createSpace("dan", { id: randomUUID(), server: "s5", playerId: 4, sealed })).rejects.toThrow(
      "n'est dans aucune alliance",
    );
  });

  it("refuses a Player of another account, and a second space for the same Player", async () => {
    await create(alice);
    const { sealed } = await newSpace(bruno.pair, randomUUID(), NOW);
    await expect(service.createSpace("bruno", { id: randomUUID(), server: "s5", playerId: 1, sealed })).rejects.toThrow(
      "n'est pas rattaché",
    );
    const again = randomUUID();
    const second = await newSpace(alice.pair, again, NOW);
    await expect(
      service.createSpace("alice", { id: again, server: "s5", playerId: 1, sealed: second.sealed }),
    ).rejects.toThrow("déjà dans un espace");
  });

  it("lets several spaces carry the same tag, listed to the alliance's Players", async () => {
    await create(alice);
    const first = spaceId;
    spaceId = randomUUID();
    const { sealed } = await newSpace(bruno.pair, spaceId, NOW);
    await service.createSpace("bruno", { id: spaceId, server: "s5", playerId: 2, sealed, name: "Autre ABC" });
    const overview = await service.overview("chloe");
    expect(overview.players[0]?.joinable.map((s) => s.id).sort()).toEqual([first, spaceId].sort());
    expect(overview.players[0]?.joinable.find((s) => s.id === first)).toMatchObject({
      admins: ["Alice"],
      memberCount: 1,
    });
  });
});

describe("joining", () => {
  beforeEach(async () => {
    await create(alice);
  });

  it("shows a request to the Admins only, then the newcomer reads the space after approval and not before", async () => {
    const secret = await encryptData('{"convois":[]}', await keyringOf(alice));
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });

    const invitation = (await service.view("bruno", spaceId)) as Invitation;
    expect(invitation.kind).toBe("invitation");
    expect(invitation.request?.status).toBe("pending");
    // Whom to exchange the Code de sécurité with.
    expect(invitation.admins).toEqual([{ pseudo: "Alice", publicKey: alice.pair.publicKey }]);
    expect((await memberView(alice)).requests).toHaveLength(1);

    await approve(alice, bruno);
    const view = await memberView(bruno);
    expect(view.me.role).toBe("member");
    expect(view.requests).toEqual([]);
    expect(await decryptData(secret, await keyringOf(bruno))).toBe('{"convois":[]}');
  });

  it("refuses a request from a Player outside the alliance, or without a passphrase", async () => {
    const outsider = await person("dan", 4, "Dan", "XYZ");
    await expect(service.requestToJoin(outsider.userId, { spaceId, playerId: 4 })).rejects.toThrow(
      "n'est pas dans l'alliance ABC",
    );
    memory.addPlayer("eve", { server: "s5", playerId: 5, pseudo: "Eve", alliance: "ABC" });
    await expect(service.requestToJoin("eve", { spaceId, playerId: 5 })).rejects.toThrow("phrase secrète");
  });

  it("asks for a reminder on Discord for a new pending request only, not for one already waiting", async () => {
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    expect(reminders).toEqual([[spaceId, "join-requests"]]);
    const [request] = (await memberView(alice)).requests;
    await service.refuse("alice", { spaceId, requestId: request?.id ?? "" });
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    expect(reminders).toHaveLength(2);
  });

  it("keeps one request per Player, cancellable, and asks again after a refusal", async () => {
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    expect((await memberView(alice)).requests).toHaveLength(1);
    await service.cancelRequest("bruno", { spaceId });
    expect((await memberView(alice)).requests).toHaveLength(0);

    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    const [request] = (await memberView(alice)).requests;
    await service.refuse("alice", { spaceId, requestId: request?.id ?? "" });
    expect((await memberView(alice)).requests[0]).toMatchObject({ status: "refused", decidedAt: new Date(NOW) });
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    expect((await memberView(alice)).requests[0]?.status).toBe("pending");
  });

  it("refuses an approval that does not seal every version, or whose certificate is not the Admin's", async () => {
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    const view = await memberView(alice);
    const request = view.requests[0];
    if (!request?.publicKey) throw new Error("no request");
    const keyring = await keyringOf(alice);
    const { sealed, certificate } = await grantAccess({
      me: alice.pair,
      keyring,
      recipient: request.publicKey,
      trust: knowledge(alice, view),
      now: NOW,
    });
    const forged = await signCertificate({ kind: "member", spaceId, subject: request.publicKey, admin: chloe.pair });
    const approval = { spaceId, requestId: request.id, publicKey: request.publicKey, sealed, certificate };
    await expect(service.approve("alice", { ...approval, certificate: forged })).rejects.toThrow("autorisation");
    const other = await signCertificate({
      kind: "member",
      spaceId: randomUUID(),
      subject: request.publicKey,
      admin: alice.pair,
    });
    await expect(service.approve("alice", { ...approval, certificate: other })).rejects.toThrow("autorisation");
    await expect(service.approve("alice", { ...approval, sealed: [] })).rejects.toThrow(SpaceError);
    await expect(service.approve("bruno", approval)).rejects.toThrow("pas membre");
    await service.approve("alice", approval);
  });

  it("makes a newcomer refuse a Clé d'alliance sealed by an Admin they did not check", async () => {
    await service.requestToJoin("bruno", { spaceId, playerId: 2 });
    // Alice approves, but Bruno never pasted her code: his trust list is empty.
    const view = await memberView(alice);
    const request = view.requests[0];
    if (!request?.publicKey) throw new Error("no request");
    const { sealed, certificate } = await grantAccess({
      me: alice.pair,
      keyring: await keyringOf(alice),
      recipient: request.publicKey,
      trust: knowledge(alice, view),
      now: NOW,
    });
    await service.approve("alice", {
      spaceId,
      requestId: request.id,
      publicKey: request.publicKey,
      sealed,
      certificate,
    });
    bruno.trust = { spaceId, verified: [], certificates: [] };
    await expect(keyringOf(bruno)).rejects.toSatisfy((e) => e instanceof CryptoError && e.code === "untrusted-signer");
  });
});

describe("roles", () => {
  beforeEach(async () => {
    await create(alice);
    await join(alice, bruno);
    await join(alice, chloe);
  });

  it("names an Admin with a certificate the members believe, and a Délégué without one", async () => {
    await nameAdmin(alice, bruno);
    await service.setRole("alice", { spaceId, playerId: 3, role: "delegate" });
    const view = await memberView(chloe);
    expect(view.members.map((m) => [m.pseudo, m.role])).toEqual([
      ["Alice", "admin"],
      ["Bruno", "admin"],
      ["Chloe", "delegate"],
    ]);
    // Chloe checked Alice's code only, and believes Bruno through Alice's certificate.
    expect((await trustedIn(knowledge(chloe, view))).admins.sort()).toEqual(
      [alice.pair.publicKey, bruno.pair.publicKey].sort(),
    );
  });

  it("refuses naming an Admin without the acting Admin's certificate", async () => {
    await expect(service.setRole("alice", { spaceId, playerId: 2, role: "admin" })).rejects.toThrow("autorisation");
    const byBruno = await signCertificate({ kind: "admin", spaceId, subject: bruno.pair.publicKey, admin: chloe.pair });
    await expect(
      service.setRole("alice", { spaceId, playerId: 2, role: "admin", certificate: byBruno }),
    ).rejects.toThrow("autorisation");
    await expect(service.setRole("bruno", { spaceId, playerId: 3, role: "delegate" })).rejects.toThrow("Seul un Admin");
  });

  it("withdraws an Admin with a revocation; never the last one, never oneself", async () => {
    await nameAdmin(alice, bruno);
    const input = await prepareWithdrawal(alice, bruno, NOW + 2000);
    await expect(service.withdrawAdmin("alice", { ...input, playerId: 1 })).rejects.toThrow("un autre Admin");
    await service.withdrawAdmin("alice", input);
    expect((await memberView(chloe)).members.find((m) => m.pseudo === "Bruno")?.role).toBe("member");
    expect((await trustedIn(knowledge(chloe, await memberView(chloe)))).admins).toEqual([alice.pair.publicKey]);
  });

  it("refuses a revocation signed by a key that is no longer an Admin of the space", async () => {
    await nameAdmin(alice, bruno);
    await nameAdmin(alice, chloe);
    // Bruno prepares the withdrawal of Chloe, then loses his role before sending it.
    const byBruno = await prepareWithdrawal(bruno, chloe, NOW + 3000);
    await withdraw(alice, bruno);
    await expect(service.withdrawAdmin("bruno", byBruno)).rejects.toThrow("Seul un Admin");
    await expect(service.addCertificates("bruno", { spaceId, certificates: [byBruno.revocation] })).rejects.toThrow(
      "Seul un Admin",
    );
    // Even through an Admin's hands, a revocation is not one of the certificates an Admin adds silently.
    await expect(service.addCertificates("alice", { spaceId, certificates: [byBruno.revocation] })).rejects.toThrow(
      "autorisation",
    );
  });
});

describe("leaving and deleting", () => {
  beforeEach(async () => {
    await create(alice);
    await join(alice, bruno);
  });

  it("lets a member leave; the last Admin names someone first, or goes with the space when alone", async () => {
    await expect(service.leave("alice", { spaceId })).rejects.toThrow("Nommez un autre Admin");
    expect(await service.leave("bruno", { spaceId })).toEqual({ deleted: false });
    await expect(service.view("bruno", spaceId)).resolves.toMatchObject({ kind: "invitation" });
    expect(await service.leave("alice", { spaceId })).toEqual({ deleted: true });
    await expect(service.view("alice", spaceId)).rejects.toThrow("n'existe pas");
  });

  it("deletes the space when an Admin types its name", async () => {
    await expect(service.deleteSpace("bruno", { spaceId, name: "ABC sur S5" })).rejects.toThrow("Seul un Admin");
    await expect(service.deleteSpace("alice", { spaceId, name: "ABC" })).rejects.toThrow("nom exact");
    await service.rename("alice", { spaceId, name: "  Les ABC  " });
    await service.deleteSpace("alice", { spaceId, name: "Les ABC" });
    await expect(service.view("alice", spaceId)).rejects.toThrow("n'existe pas");
  });

  it("blocks deleting the account of the last Admin of a space with other members", () => {
    expect(lastAdminBlocker([{ spaceName: "ABC sur S5", role: "admin", admins: 1, members: 2 }])).toBe(
      "Nommez un autre Admin de ABC sur S5 d'abord.",
    );
    expect(lastAdminBlocker([{ spaceName: "ABC sur S5", role: "admin", admins: 1, members: 1 }])).toBeNull();
    expect(lastAdminBlocker([{ spaceName: "ABC sur S5", role: "admin", admins: 2, members: 3 }])).toBeNull();
  });
});

describe("a forgotten passphrase", () => {
  beforeEach(async () => {
    await create(alice);
    await join(alice, bruno);
  });

  it("makes the member « clé à renvoyer » until an Admin sends the access again", async () => {
    const secret = await encryptData("état", await keyringOf(alice));
    const fresh = await generateKeyPair();
    await service.forgetPassphrase("bruno", { publicKey: fresh.publicKey, lockedPrivateKey: LOCKED });
    bruno = { ...bruno, pair: fresh, trust: { spaceId, verified: [], certificates: [] } };

    const before = await memberView(bruno);
    expect(before.me.keyStatus).toBe("resend");
    expect(before.sealed).toEqual([]);
    expect((await service.key("bruno"))?.trustList).toBeNull();
    const seen = (await memberView(alice)).members.find((m) => m.pseudo === "Bruno");
    expect(seen).toMatchObject({ keyStatus: "resend", publicKey: fresh.publicKey });

    // The same path as an approval: codes again, then the boxes for the new key.
    exchangeCodes(alice, bruno);
    const view = await memberView(alice);
    const { sealed, certificate } = await grantAccess({
      me: alice.pair,
      keyring: await keyringOf(alice),
      recipient: fresh.publicKey,
      trust: knowledge(alice, view),
      now: NOW + 5000,
    });
    await expect(
      service.resend("alice", { spaceId, playerId: 2, publicKey: alice.pair.publicKey, sealed, certificate }),
    ).rejects.toThrow("rechargez");
    await service.resend("alice", { spaceId, playerId: 2, publicKey: fresh.publicKey, sealed, certificate });
    expect((await memberView(bruno)).me.keyStatus).toBe("current");
    expect(await decryptData(secret, await keyringOf(bruno))).toBe("état");
  });

  it("keeps an Admin « clé à renvoyer » from acting as an Admin", async () => {
    const fresh = await generateKeyPair();
    await service.forgetPassphrase("alice", { publicKey: fresh.publicKey, lockedPrivateKey: LOCKED });
    await expect(service.setRole("alice", { spaceId, playerId: 2, role: "delegate" })).rejects.toThrow("renvoyé");
  });
});

describe("the trust list on the site", () => {
  it("keeps the latest list and refuses to overwrite a newer one", async () => {
    const blob = "B".repeat(80);
    expect(await service.saveTrustList("alice", { trustList: blob, expectedRevision: 0 })).toEqual({ revision: 1 });
    await expect(service.saveTrustList("alice", { trustList: blob, expectedRevision: 0 })).rejects.toThrow(
      "trust-list-conflict",
    );
    expect(await service.key("alice")).toMatchObject({ trustList: blob, trustListRevision: 1 });
  });
});

/** « Exclure »: what the Admin's browser signs and seals, from what it knows of the space. */
async function prepareExclusion(admin: Person, target: Person, now = NOW + 10_000) {
  const view = await memberView(admin);
  const member = view.members.find((m) => m.playerId === target.playerId);
  if (!member) throw new Error("not a member");
  const remaining = view.members
    .filter((m) => m.playerId !== target.playerId && m.keyStatus === "current" && m.publicKey)
    .map((m) => ({ playerId: m.playerId, publicKey: m.publicKey ?? "" }));
  const prepared = await excludeMember({
    me: admin.pair,
    keyring: await keyringOf(admin),
    subject: member.sealedFor,
    trust: knowledge(admin, view),
    remaining,
    now,
  });
  return {
    spaceId,
    playerId: target.playerId,
    exclusion: prepared.exclusion,
    certificates: prepared.resigned,
    version: prepared.version,
    sealed: prepared.sealed,
  };
}

async function exclude(admin: Person, target: Person) {
  const input = await prepareExclusion(admin, target);
  await service.exclude(admin.userId, input);
  admin.trust.certificates.push(input.exclusion, ...input.certificates);
  return input;
}

describe("excluding a member", () => {
  let dan: Person;

  beforeEach(async () => {
    dan = await person("dan", 4, "Dan");
    await create(alice);
    await join(alice, bruno);
    await join(alice, chloe);
    await join(alice, dan);
  });

  it("cuts the access at once: the excluded member does not read what is sent after, the others read everything", async () => {
    const danKeyring = await keyringOf(dan);
    const before = await encryptData("avant", await keyringOf(alice));
    await exclude(alice, dan);

    await expect(service.view("dan", spaceId)).resolves.toMatchObject({ kind: "invitation" });
    const keyring = await keyringOf(alice);
    expect(keyring.map((k) => k.version)).toEqual([1, 2]);
    const after = await encryptData("après", keyring);
    await expect(decryptData(after, danKeyring)).rejects.toSatisfy(
      (e) => e instanceof CryptoError && e.code === "missing-key-version",
    );
    for (const who of [bruno, chloe]) {
      const theirs = await keyringOf(who);
      expect(await decryptData(before, theirs)).toBe("avant");
      expect(await decryptData(after, theirs)).toBe("après");
    }
    const view = await memberView(bruno);
    expect(view.versions).toEqual([1, 2]);
    expect(view.members.map((m) => [m.pseudo, m.keyStatus])).toEqual([
      ["Alice", "current"],
      ["Bruno", "current"],
      ["Chloe", "current"],
    ]);
    // The exclusion is signed and kept: nobody believes Dan's key any more.
    expect((await trustedIn(knowledge(bruno, view))).members).not.toContain(dan.pair.publicKey);
  });

  it("lets the members open a version sealed by another Admin than the one they entered with", async () => {
    await nameAdmin(alice, bruno);
    // Chloe entered through Alice; Bruno excludes Dan and seals the new version.
    await exclude(bruno, dan);
    const view = await memberView(chloe);
    expect(view.sealed.map((s) => s.version)).toEqual([1, 2]);
    expect((await keyringOf(chloe)).map((k) => k.version)).toEqual([1, 2]);
  });

  it("re-signs what an excluded Admin had signed, so that the members they let in still get the new version", async () => {
    const eve = await person("eve", 5, "Eve");
    await nameAdmin(alice, bruno);
    // After Bruno became an Admin (NOW + 1000).
    await join(bruno, eve, NOW + 5000);
    const input = await exclude(alice, bruno);
    const resigned = await Promise.all(input.certificates.map((c) => openCertificate(c, spaceId)));
    expect(resigned.map((c) => [c.kind, c.issuer, c.subject])).toContainEqual([
      "member",
      alice.pair.publicKey,
      eve.pair.publicKey,
    ]);
    expect(input.sealed.map((s) => s.playerId).sort()).toEqual([1, 3, 4, 5]);
    // Eve's only root was Bruno: she believes nobody now, and exchanges the code with Alice (ADR 0005).
    await expect(keyringOf(eve)).rejects.toSatisfy((e) => e instanceof CryptoError && e.code === "untrusted-signer");
    exchangeCodes(alice, eve);
    expect((await keyringOf(eve)).map((k) => k.version)).toEqual([1, 2]);
  });

  it("seals the new version for believed members only; the others get it through « Renvoyer l'accès »", async () => {
    // A member the site would add on its own, without any Admin's certificate.
    const eve = await person("eve", 5, "Eve");
    const fake = (await memberView(alice)).sealed;
    await memory.store.inSpace(spaceId, (tx) =>
      tx.addMember({ server: "s5", playerId: 5, role: "member", publicKey: eve.pair.publicKey }, fake),
    );
    const input = await exclude(alice, dan);
    expect(input.sealed.map((s) => s.playerId).sort()).toEqual([1, 2, 3]);

    const eveView = await memberView(eve);
    expect(eveView.me.keyStatus).toBe("resend");
    // Older versions stay to read older data; the new one waits for an Admin.
    expect(eveView.sealed.map((s) => s.version)).toEqual([1]);
    const seen = (await memberView(alice)).members.find((m) => m.pseudo === "Eve");
    expect(seen?.keyStatus).toBe("resend");

    exchangeCodes(alice, eve);
    const view = await memberView(alice);
    const { sealed, certificate } = await grantAccess({
      me: alice.pair,
      keyring: await keyringOf(alice),
      recipient: eve.pair.publicKey,
      trust: knowledge(alice, view),
      now: NOW + 20_000,
    });
    await service.resend("alice", { spaceId, playerId: 5, publicKey: eve.pair.publicKey, sealed, certificate });
    expect((await memberView(eve)).me.keyStatus).toBe("current");
    expect((await keyringOf(eve)).map((k) => k.version)).toEqual([1, 2]);
  });

  it("refuses a second version of the same number: two Admins excluding at once", async () => {
    await nameAdmin(alice, bruno);
    const [byAlice, byBruno] = await Promise.all([prepareExclusion(alice, dan), prepareExclusion(bruno, chloe)]);
    expect([byAlice.version, byBruno.version]).toEqual([2, 2]);
    await service.exclude("alice", byAlice);
    await expect(service.exclude("bruno", byBruno)).rejects.toThrow("Un autre Admin vient de changer l'accès");
    const view = await memberView(bruno);
    expect(view.versions).toEqual([1, 2]);
    expect(view.members.map((m) => m.pseudo)).toEqual(["Alice", "Bruno", "Chloe"]);
    // Bruno, once the page is reloaded, excludes Chloe with version 3.
    bruno.trust.certificates.push(byAlice.exclusion);
    await exclude(bruno, chloe);
    expect((await memberView(alice)).versions).toEqual([1, 2, 3]);
  });

  it("refuses an exclusion not signed by the acting Admin, of oneself, by a non-Admin, or badly sealed", async () => {
    const input = await prepareExclusion(alice, dan);
    const forged = await signCertificate({
      kind: "exclusion",
      spaceId,
      subject: dan.pair.publicKey,
      admin: chloe.pair,
    });
    const asMember = await signCertificate({ kind: "member", spaceId, subject: dan.pair.publicKey, admin: alice.pair });
    await expect(service.exclude("alice", { ...input, exclusion: forged })).rejects.toThrow("autorisation");
    await expect(service.exclude("alice", { ...input, exclusion: asMember })).rejects.toThrow("autorisation");
    await expect(service.exclude("bruno", input)).rejects.toThrow("Seul un Admin");
    await expect(service.exclude("alice", { ...input, playerId: 1 })).rejects.toThrow("Quitter");
    const boxes = input.sealed[0]?.sealed ?? [];
    // For the excluded member, without the acting Admin, twice the same member, without every version, or none.
    const badly = [
      [...input.sealed, { playerId: 4, sealed: boxes }],
      input.sealed.filter((s) => s.playerId !== 1),
      [...input.sealed, { playerId: 2, sealed: boxes }],
      input.sealed.map((s) => ({ ...s, sealed: s.sealed.filter((b) => b.version === 2) })),
      [],
    ];
    for (const sealed of badly)
      await expect(service.exclude("alice", { ...input, sealed })).rejects.toThrow(SpaceError);
    await expect(service.exclude("alice", { ...input, version: 3 })).rejects.toThrow("Un autre Admin");
    await expect(service.exclude("alice", { ...input, version: 1 })).rejects.toThrow("Un autre Admin");
    // Nothing changed on the way.
    expect((await memberView(alice)).versions).toEqual([1]);
    await service.exclude("alice", input);
  });

  it("excludes an Admin too, who loses everything", async () => {
    await nameAdmin(alice, bruno);
    await exclude(alice, bruno);
    await expect(service.view("bruno", spaceId)).resolves.toMatchObject({ kind: "invitation" });
    const view = await memberView(chloe);
    expect((await trustedIn(knowledge(chloe, view))).admins).toEqual([alice.pair.publicKey]);
  });
});

describe("absence alerts", () => {
  beforeEach(async () => {
    await create(alice);
    await join(alice, bruno);
    await join(alice, chloe);
    await service.setRole("alice", { spaceId, playerId: 3, role: "delegate" });
  });

  it("are kept encrypted for the Admins and the Délégués, not shown to the other members", async () => {
    const blob = await encryptData('{"absent":[]}', await keyringOf(alice));
    expect((await memberView(alice)).absenceAlerts).toBeNull();
    expect(await service.saveAbsenceAlerts("chloe", { spaceId, blob, expectedRevision: 0 })).toEqual({ revision: 1 });
    expect((await memberView(alice)).absenceAlerts).toEqual({ blob, revision: 1 });
    expect((await memberView(chloe)).absenceAlerts).toEqual({ blob, revision: 1 });
    expect((await memberView(bruno)).absenceAlerts).toBeNull();
    await expect(service.saveAbsenceAlerts("bruno", { spaceId, blob, expectedRevision: 1 })).rejects.toThrow(
      "Admin ou un Délégué",
    );
  });

  it("refuse to overwrite alerts written meanwhile", async () => {
    const blob = await encryptData('{"absent":[]}', await keyringOf(alice));
    await service.saveAbsenceAlerts("alice", { spaceId, blob, expectedRevision: 0 });
    await expect(service.saveAbsenceAlerts("chloe", { spaceId, blob, expectedRevision: 0 })).rejects.toThrow(
      "rechargez",
    );
    expect(await service.saveAbsenceAlerts("chloe", { spaceId, blob, expectedRevision: 1 })).toEqual({ revision: 2 });
    await expect(service.saveAbsenceAlerts("alice", { spaceId, blob: "court", expectedRevision: 2 })).rejects.toThrow(
      SpaceError,
    );
  });
});

describe("the Discord webhook", () => {
  beforeEach(async () => {
    await create(alice);
    await join(alice, bruno);
    await join(alice, chloe);
    await service.setRole("alice", { spaceId, playerId: 3, role: "delegate" });
  });

  const settings = '{"v":1,"url":"https://discord.com/api/webhooks/1/t","events":["convoys"],"urlSetAtVersion":1}';

  it("is saved encrypted by an Admin alone, and shown to the Admins", async () => {
    const blob = await encryptData(settings, await keyringOf(alice));
    expect((await memberView(alice)).discord).toBeNull();
    await expect(service.saveDiscord("chloe", { spaceId, blob, expectedRevision: 0 })).rejects.toThrow("Seul un Admin");
    await expect(service.saveDiscord("bruno", { spaceId, blob, expectedRevision: 0 })).rejects.toThrow("Seul un Admin");
    expect(await service.saveDiscord("alice", { spaceId, blob, expectedRevision: 0 })).toEqual({ revision: 1 });
    expect((await memberView(alice)).discord).toEqual({ blob, revision: 1, refusal: null });
    expect((await memberView(chloe)).discord).toBeNull();
    expect((await memberView(bruno)).discord).toBeNull();
  });

  it("refuses to overwrite a save made meanwhile, or one not encrypted with the newest version", async () => {
    const keyring = await keyringOf(alice);
    const blob = await encryptData(settings, keyring);
    await service.saveDiscord("alice", { spaceId, blob, expectedRevision: 0 });
    await expect(service.saveDiscord("alice", { spaceId, blob, expectedRevision: 0 })).rejects.toThrow("rechargez");
    await expect(service.saveDiscord("alice", { spaceId, blob: "court", expectedRevision: 1 })).rejects.toThrow(
      SpaceError,
    );
    await exclude(alice, chloe);
    // Encrypted with version 1 while the space has version 2.
    await expect(service.saveDiscord("alice", { spaceId, blob, expectedRevision: 1 })).rejects.toThrow(
      "Un autre Admin",
    );
    const newer = await encryptData(settings, await keyringOf(alice));
    expect(await service.saveDiscord("alice", { spaceId, blob: newer, expectedRevision: 1 })).toEqual({ revision: 2 });
  });

  it("is handed to every member's extension, and to nobody else", async () => {
    const blob = await encryptData(settings, await keyringOf(alice));
    expect(await service.discordForExtension("bruno")).toEqual([]);
    await service.saveDiscord("alice", { spaceId, blob, expectedRevision: 0 });
    expect(await service.discordForExtension("bruno")).toEqual([{ spaceId, blob, revision: 1 }]);
    const dan = await person("dan", 4, "Dan");
    expect(await service.discordForExtension(dan.userId)).toEqual([]);
  });

  it("shows the Admins a refusal a member's extension reported, until the webhook is saved again", async () => {
    const blob = await encryptData(settings, await keyringOf(alice));
    await service.saveDiscord("alice", { spaceId, blob, expectedRevision: 0 });
    await service.reportDiscordRefusal("bruno", { spaceId, revision: 1, status: 404 });
    expect((await memberView(alice)).discord?.refusal).toEqual({ status: 404, at: new Date(NOW), pseudo: "Bruno" });
    // A report about an older save says nothing of this one.
    await service.reportDiscordRefusal("chloe", { spaceId, revision: 0, status: 401 });
    expect((await memberView(alice)).discord?.refusal?.pseudo).toBe("Bruno");
    await service.saveDiscord("alice", { spaceId, blob, expectedRevision: 1 });
    expect((await memberView(alice)).discord?.refusal).toBeNull();
  });

  it("takes refusals only from members, and only Discord's 4xx but a rate limit", async () => {
    const blob = await encryptData(settings, await keyringOf(alice));
    await service.saveDiscord("alice", { spaceId, blob, expectedRevision: 0 });
    const dan = await person("dan", 4, "Dan");
    await expect(service.reportDiscordRefusal(dan.userId, { spaceId, revision: 1, status: 404 })).rejects.toThrow(
      "pas membre",
    );
    for (const status of [200, 429, 500, 99])
      await expect(service.reportDiscordRefusal("bruno", { spaceId, revision: 1, status })).rejects.toThrow(SpaceError);
  });
});

describe("a Player who left the alliance", () => {
  it("is offered to leave the space, on the space's page and on /spaces", async () => {
    await create(alice);
    await join(alice, bruno);
    expect((await memberView(bruno)).leaveProposal).toBeNull();
    memory.setAlliance({ server: "s5", playerId: 2 }, "XYZ");
    expect((await memberView(bruno)).leaveProposal).toEqual({ alliance: "XYZ" });
    expect((await service.overview("bruno")).players[0]?.membership?.leftAlliance).toBe(true);
    memory.setAlliance({ server: "s5", playerId: 2 }, null);
    expect((await memberView(bruno)).leaveProposal).toEqual({ alliance: null });
    memory.setAlliance({ server: "s5", playerId: 2 }, "abc");
    expect((await memberView(bruno)).leaveProposal).toBeNull();
    expect((await service.overview("bruno")).players[0]?.membership?.leftAlliance).toBe(false);
  });
});

/** « Retirer Admin »: what the Admin's browser signs and seals, from what it knows of the space. */
async function prepareWithdrawal(admin: Person, target: Person, now = NOW + 20_000) {
  const view = await memberView(admin);
  const member = view.members.find((m) => m.playerId === target.playerId);
  if (!member) throw new Error("not a member");
  const prepared = await withdrawAdmin({
    me: admin.pair,
    keyring: await keyringOf(admin),
    subject: member.sealedFor,
    trust: knowledge(admin, view),
    remaining: view.members
      .filter((m) => m.keyStatus === "current")
      .map((m) => ({ playerId: m.playerId, publicKey: m.sealedFor })),
    now,
  });
  return {
    spaceId,
    playerId: target.playerId,
    revocation: prepared.revocation,
    certificates: prepared.resigned,
    sealed: prepared.sealed,
  };
}

async function withdraw(admin: Person, target: Person) {
  const input = await prepareWithdrawal(admin, target);
  await service.withdrawAdmin(admin.userId, input);
  admin.trust.certificates.push(input.revocation, ...input.certificates);
  return input;
}

describe("withdrawing an Admin", () => {
  let dan: Person;

  beforeEach(async () => {
    dan = await person("dan", 4, "Dan");
    await create(alice);
    await join(alice, bruno);
    await join(alice, chloe);
    await join(alice, dan);
    await nameAdmin(alice, bruno);
  });

  it("seals every version again: the boxes the withdrawn Admin had sealed stop opening with the withdrawal", async () => {
    // Bruno excluded Dan: every box of the space, version 1 included, is now signed by Bruno.
    await exclude(bruno, dan);
    const before = await encryptData("avant", await keyringOf(chloe));
    await withdraw(alice, bruno);

    const view = await memberView(chloe);
    expect(view.members.map((m) => [m.pseudo, m.role, m.keyStatus])).toEqual([
      ["Alice", "admin", "current"],
      ["Bruno", "member", "current"],
      ["Chloe", "member", "current"],
    ]);
    expect(view.versions).toEqual([1, 2]);
    // Each believed member, the withdrawn Admin and the one who withdrew included, opens every version.
    for (const who of [alice, bruno, chloe]) {
      const keyring = await keyringOf(who);
      expect(keyring.map((k) => k.version)).toEqual([1, 2]);
      expect(await decryptData(before, keyring)).toBe("avant");
    }
    expect((await trustedIn(knowledge(chloe, view))).admins).toEqual([alice.pair.publicKey]);
  });

  it("refuses a withdrawal not signed by the acting Admin, of oneself, of the last Admin, or badly sealed", async () => {
    const input = await prepareWithdrawal(alice, bruno);
    expect(input.sealed.map((s) => s.playerId).sort()).toEqual([1, 2, 3, 4]);
    const forged = await signCertificate({
      kind: "admin-revocation",
      spaceId,
      subject: bruno.pair.publicKey,
      admin: chloe.pair,
    });
    const asExclusion = await signCertificate({
      kind: "exclusion",
      spaceId,
      subject: bruno.pair.publicKey,
      admin: alice.pair,
    });
    await expect(service.withdrawAdmin("alice", { ...input, revocation: forged })).rejects.toThrow("autorisation");
    await expect(service.withdrawAdmin("alice", { ...input, revocation: asExclusion })).rejects.toThrow("autorisation");
    await expect(service.withdrawAdmin("chloe", input)).rejects.toThrow("Seul un Admin");
    await expect(service.withdrawAdmin("alice", { ...input, playerId: 1 })).rejects.toThrow("un autre Admin");
    await expect(service.withdrawAdmin("alice", { ...input, playerId: 3 })).rejects.toThrow("rechargez");
    // Not through a change of role either.
    await expect(service.setRole("alice", { spaceId, playerId: 2, role: "member" })).rejects.toThrow(SpaceError);
    const boxes = input.sealed[0]?.sealed ?? [];
    // Without the acting Admin, twice the same member, for someone outside the space, without every version, or none.
    const badly = [
      input.sealed.filter((s) => s.playerId !== 1),
      [...input.sealed.filter((s) => s.playerId !== 3), { playerId: 2, sealed: boxes }],
      [...input.sealed.filter((s) => s.playerId !== 4), { playerId: 9, sealed: boxes }],
      input.sealed.map((s) => ({ ...s, sealed: [] })),
      [],
    ];
    for (const sealed of badly)
      await expect(service.withdrawAdmin("alice", { ...input, sealed })).rejects.toThrow(SpaceError);
    // Nothing changed on the way.
    expect((await memberView(alice)).members.find((m) => m.pseudo === "Bruno")?.role).toBe("admin");
    await service.withdrawAdmin("alice", input);
    expect((await memberView(alice)).members.find((m) => m.pseudo === "Bruno")?.role).toBe("member");
  });

  it("refuses a sealing missing a version", async () => {
    await exclude(alice, dan);
    const input = await prepareWithdrawal(alice, bruno);
    const sealed = input.sealed.map((s) => ({ ...s, sealed: s.sealed.filter((b) => b.version === 2) }));
    await expect(service.withdrawAdmin("alice", { ...input, sealed })).rejects.toThrow("rechargez");
  });

  it("leaves a member one does not believe « à renvoyer », still reading what they read", async () => {
    // Eve's access was sealed by Alice, but the site added her without any certificate: Alice does not believe her.
    const eve = await person("eve", 5, "Eve");
    exchangeCodes(alice, eve);
    alice.trust.verified = alice.trust.verified.filter((v) => v.publicKey !== eve.pair.publicKey);
    eve.trust = { spaceId, verified: eve.trust.verified, certificates: [] };
    const view = await memberView(alice);
    const { sealed } = await grantAccess({
      me: alice.pair,
      keyring: await keyringOf(alice),
      recipient: eve.pair.publicKey,
      trust: knowledge(alice, view),
      now: NOW + 5000,
    });
    await memory.store.inSpace(spaceId, (tx) =>
      tx.addMember({ server: "s5", playerId: 5, role: "member", publicKey: eve.pair.publicKey }, sealed),
    );
    const message = await encryptData("avant", await keyringOf(alice));

    const input = await withdraw(alice, bruno);
    expect(input.sealed.map((s) => s.playerId).sort()).toEqual([1, 2, 3, 4]);
    const eveView = await memberView(eve);
    expect(eveView.me.keyStatus).toBe("resend");
    expect(await decryptData(message, await keyringOf(eve))).toBe("avant");
    expect((await memberView(alice)).members.find((m) => m.pseudo === "Eve")?.keyStatus).toBe("resend");
    expect((await service.overview("eve")).players[0]?.membership?.keyStatus).toBe("resend");

    // « Renvoyer l'accès » after the Code de sécurité.
    exchangeCodes(alice, eve);
    const now = await memberView(alice);
    const resent = await grantAccess({
      me: alice.pair,
      keyring: await keyringOf(alice),
      recipient: eve.pair.publicKey,
      trust: knowledge(alice, now),
      now: NOW + 30_000,
    });
    await service.resend("alice", { spaceId, playerId: 5, publicKey: eve.pair.publicKey, ...resent });
    expect((await memberView(eve)).me.keyStatus).toBe("current");
  });

  it("keeps one Admin when two Admins withdraw each other: the second is no longer an Admin", async () => {
    const [byAlice, byBruno] = await Promise.all([prepareWithdrawal(alice, bruno), prepareWithdrawal(bruno, alice)]);
    await service.withdrawAdmin("alice", byAlice);
    await expect(service.withdrawAdmin("bruno", byBruno)).rejects.toThrow("Seul un Admin");
    const view = await memberView(chloe);
    expect(view.members.filter((m) => m.role === "admin").map((m) => m.pseudo)).toEqual(["Alice"]);
    expect((await keyringOf(chloe)).map((k) => k.version)).toEqual([1]);
  });
});
