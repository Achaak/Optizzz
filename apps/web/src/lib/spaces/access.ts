// What a browser seals and signs for an Alliance Space, without the person ever handling a key (docs/features/site-
// comptes-espaces.md, « Confiance et parcours » ; ADR 0005, « Qui croire »). Each function takes what one knows of the
// space (`SpaceTrust`: one's trust list and the site's certificates) and returns what to send to the site.
import {
  createAllianceKeyring,
  openAllianceKeyring,
  sealAllianceKeyring,
  type AllianceKeyring,
  type SealedAllianceKey,
} from "@optizzz/crypto/alliance-key";
import { openCertificate, signCertificate, type Certificate, type CertificateKind } from "@optizzz/crypto/certificate";
import type { KeyPair } from "@optizzz/crypto/personal-key";
import { whoToTrust, type SpaceTrust, type Trusted, type VerifiedKey } from "@optizzz/crypto/trust";

/** The certificates of a space that open (valid signature for it), and those that do not (`bad-certificate`). */
export async function openCertificates(
  trust: SpaceTrust,
): Promise<{ valid: Certificate[]; validBlobs: string[]; bad: string[] }> {
  const opened = await Promise.all(
    trust.certificates.map(async (blob) => ({
      blob,
      certificate: await openCertificate(blob, trust.spaceId).catch(() => null),
    })),
  );
  return {
    valid: opened.flatMap((o) => (o.certificate ? [o.certificate] : [])),
    validBlobs: opened.flatMap((o) => (o.certificate ? [o.blob] : [])),
    bad: opened.flatMap((o) => (o.certificate ? [] : [o.blob])),
  };
}

/**
 * The date of a new statement about `subject`: now, or one millisecond after the latest statement known about it,
 * so that a clock running late does not lose a new certificate against an older revocation (ADR 0005, « Signer »).
 */
export async function nextIssuedAt(trust: SpaceTrust, subject: string, now: number): Promise<number> {
  const { valid } = await openCertificates(trust);
  const latest = Math.max(-1, ...valid.filter((c) => c.subject === subject).map((c) => c.issuedAt));
  return Math.max(now, latest + 1);
}

async function sign(
  me: KeyPair,
  trust: SpaceTrust,
  kind: CertificateKind,
  subject: string,
  now: number,
): Promise<string> {
  return signCertificate({
    kind,
    spaceId: trust.spaceId,
    subject,
    admin: me,
    issuedAt: await nextIssuedAt(trust, subject, now),
  });
}

const addCertificates = (trust: SpaceTrust, blobs: string[]): SpaceTrust => ({
  ...trust,
  certificates: [...trust.certificates, ...blobs],
});

/**
 * « Créer un espace »: the first Clé d'alliance, drawn here and sealed for oneself, signed by oneself; the creator is
 * their own root as an Admin (ADR 0005, « Ce que doit faire l'interface »).
 */
export async function newSpace(
  me: KeyPair,
  spaceId: string,
  now: number,
): Promise<{ sealed: SealedAllianceKey[]; root: VerifiedKey }> {
  const keyring = await createAllianceKeyring();
  return {
    sealed: await sealAllianceKeyring(keyring, { spaceId, recipient: me.publicKey, admin: me }),
    root: { publicKey: me.publicKey, role: "admin", verifiedAt: now },
  };
}

/** Whom to believe in a space, from what one knows. */
export const trustedIn = (trust: SpaceTrust): Promise<Trusted> => whoToTrust(trust);

/** One's Clé d'alliance, every version, accepted only if a believed Admin sealed it for oneself in this space. */
export async function openSpace(
  me: KeyPair,
  sealed: readonly SealedAllianceKey[],
  trust: SpaceTrust,
): Promise<AllianceKeyring> {
  const { admins } = await whoToTrust(trust);
  return openAllianceKeyring(
    sealed.map((s) => s.sealed),
    { spaceId: trust.spaceId, member: me, trusted: admins },
  );
}

/**
 * « Donner l'accès » (or « Renvoyer l'accès » after a forgotten passphrase): every version sealed for the person's key,
 * and the certificate that lets the other members believe it. `kind` is « admin » to give an Admin their access back.
 */
export async function grantAccess({
  me,
  keyring,
  recipient,
  trust,
  kind = "member",
  now,
}: {
  me: KeyPair;
  keyring: AllianceKeyring;
  recipient: string;
  trust: SpaceTrust;
  kind?: "member" | "admin";
  now: number;
}): Promise<{ sealed: SealedAllianceKey[]; certificate: string }> {
  return {
    sealed: await sealAllianceKeyring(keyring, { spaceId: trust.spaceId, recipient, admin: me }),
    certificate: await sign(me, trust, kind, recipient, now),
  };
}

/** A certificate after a Code de sécurité: « Nommer Admin », or a changed key certified again. */
export const certify = ({
  me,
  subject,
  kind,
  trust,
  now,
}: {
  me: KeyPair;
  subject: string;
  kind: "member" | "admin";
  trust: SpaceTrust;
  now: number;
}) => sign(me, trust, kind, subject, now);

/**
 * After a revocation: the member and Admin certificates that stop counting with it (those an excluded Admin signed, or
 * signed after a withdrawal by a clock running ahead), signed again in one's own name for the keys of `keep` one still
 * believed (ADR 0005, « Ce que doit faire l'interface »). Used for a withdrawal here, and by an exclusion (ticket 18).
 */
export async function resignAfterRevocation({
  me,
  trust,
  revocation,
  keep,
  now,
}: {
  me: KeyPair;
  trust: SpaceTrust;
  revocation: string;
  keep: readonly string[];
  now: number;
}): Promise<string[]> {
  const revoked = await openCertificate(revocation, trust.spaceId);
  const after = addCertificates(trust, [revocation]);
  const [before, then] = await Promise.all([whoToTrust(trust), whoToTrust(after)]);
  const kept = (key: string) => keep.includes(key) && key !== me.publicKey;
  const lostAdmins = before.admins.filter((k) => !then.admins.includes(k) && k !== revoked.subject && kept(k));
  const lostMembers = before.members.filter(
    (k) =>
      !then.members.includes(k) &&
      !lostAdmins.includes(k) &&
      !(revoked.kind === "exclusion" && k === revoked.subject) &&
      kept(k),
  );
  const signed: string[] = [];
  for (const [kind, keys] of [
    ["admin", lostAdmins],
    ["member", lostMembers],
  ] as const) {
    for (const key of keys) signed.push(await sign(me, addCertificates(after, signed), kind, key, now));
  }
  return signed;
}

/** « Retirer Admin »: the revocation, and the certificates signed again with it. */
export async function withdrawAdmin({
  me,
  subject,
  trust,
  keep,
  now,
}: {
  me: KeyPair;
  subject: string;
  trust: SpaceTrust;
  keep: readonly string[];
  now: number;
}): Promise<{ revocation: string; resigned: string[] }> {
  const revocation = await sign(me, trust, "admin-revocation", subject, now);
  return { revocation, resigned: await resignAfterRevocation({ me, trust, revocation, keep, now }) };
}

/**
 * What an Admin owes, signed silently on their page: an Admin certificate for every Admin they believe that is an
 * Admin of the space on the site, so that the members they let in believe those Admins too, and count their
 * revocations (ADR 0005, « Ce que doit faire l'interface »). Nothing when one is not a believed Admin oneself.
 */
export async function owedAdminCertificates({
  me,
  trust,
  siteAdmins,
  now,
}: {
  me: KeyPair;
  trust: SpaceTrust;
  siteAdmins: readonly string[];
  now: number;
}): Promise<string[]> {
  const { admins } = await whoToTrust(trust);
  if (!admins.includes(me.publicKey)) return [];
  const { valid } = await openCertificates(trust);
  const owed = admins.filter((key) => {
    if (key === me.publicKey || !siteAdmins.includes(key)) return false;
    const about = valid.filter((c) => c.subject === key);
    const lastRevocation = Math.max(
      -1,
      ...about.filter((c) => c.kind === "admin-revocation" || c.kind === "exclusion").map((c) => c.issuedAt),
    );
    return !about.some((c) => c.kind === "admin" && c.issuer === me.publicKey && c.issuedAt > lastRevocation);
  });
  const signed: string[] = [];
  for (const key of owed) signed.push(await sign(me, addCertificates(trust, signed), "admin", key, now));
  return signed;
}
