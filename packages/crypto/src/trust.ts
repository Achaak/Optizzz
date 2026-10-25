import { openCertificate, type Certificate } from "./certificate";

/** A public key whose Code de sécurité one compared, in one space. */
export interface VerifiedKey {
  publicKey: string;
  /** « admin » : the Admin one exchanged the code with to enter; « member » : a newcomer one let in, as an Admin. */
  role: "admin" | "member";
  /** When the codes matched, in milliseconds since 1970, by one's own clock. */
  verifiedAt: number;
}

/** What one knows about a space's keys: the keys checked by a code, and the certificates and revocations seen. */
export interface SpaceTrust {
  spaceId: string;
  verified: VerifiedKey[];
  /** Certificate blobs (`signCertificate`), from the trust list and from the site; invalid ones are ignored. */
  certificates: string[];
}

/** The keys to believe in a space, sorted. Every Admin is a member. */
export interface Trusted {
  /** For `openAllianceKey` and `openAllianceKeyring` (`trusted`). */
  admins: string[];
  /** Whom to seal a Clé d'alliance for. */
  members: string[];
}

export async function whoToTrust(space: SpaceTrust): Promise<Trusted> {
  const opened = await Promise.all(
    space.certificates.map((blob) => openCertificate(blob, space.spaceId).catch(() => undefined)),
  );
  const certificates = opened.filter((c): c is Certificate => c !== undefined && c.issuer !== c.subject);
  const grants = certificates.filter((c) => c.kind === "member" || c.kind === "admin");

  // Every key ever believable as an Admin, revocations aside: the keys whose revocations count.
  const everAdmin = new Set(space.verified.filter((v) => v.role === "admin").map((v) => v.publicKey));
  for (let grown = true; grown;) {
    grown = false;
    for (const c of grants) {
      if (c.kind === "admin" && everAdmin.has(c.issuer) && !everAdmin.has(c.subject)) {
        everAdmin.add(c.subject);
        grown = true;
      }
    }
  }
  // Dates of the revocations that count, per revoked key.
  const revocations = new Map<string, number[]>();
  const exclusions = new Map<string, number[]>();
  for (const c of certificates) {
    if (!everAdmin.has(c.issuer)) continue;
    if (c.kind === "admin-revocation" || c.kind === "exclusion") push(revocations, c.subject, c.issuedAt);
    if (c.kind === "exclusion") push(exclusions, c.subject, c.issuedAt);
  }

  // Dates from which a key is an Admin. An Admin one checked was one from the start, and is again from the exchange.
  const adminGrants = new Map<string, number[]>();
  for (const v of space.verified) {
    if (v.role === "admin") push(adminGrants, v.publicKey, -Infinity, v.verifiedAt);
  }
  const isAdminAt = (key: string, at: number) =>
    (adminGrants.get(key) ?? []).some(
      (granted) =>
        granted <= at && !(revocations.get(key) ?? []).some((revoked) => revoked >= granted && revoked <= at),
    );

  // Least fixpoint: counting a certificate can only make more issuers Admins, never fewer.
  const counted = new Set<Certificate>();
  for (let grown = true; grown;) {
    grown = false;
    for (const c of grants) {
      if (counted.has(c) || !isAdminAt(c.issuer, c.issuedAt)) continue;
      if ((exclusions.get(c.issuer) ?? []).some((excluded) => excluded >= c.issuedAt)) continue;
      counted.add(c);
      grown = true;
      if (c.kind === "admin") push(adminGrants, c.subject, c.issuedAt);
    }
  }

  const admins = [...adminGrants.keys()].filter((key) => isAdminAt(key, Infinity));
  const memberGrants = new Map<string, number[]>();
  for (const v of space.verified) push(memberGrants, v.publicKey, v.verifiedAt);
  for (const c of counted) push(memberGrants, c.subject, c.issuedAt);
  const members = [...memberGrants].filter(
    ([key, dates]) => admins.includes(key) || Math.max(...dates) > Math.max(-Infinity, ...(exclusions.get(key) ?? [])),
  );
  return { admins: admins.sort(), members: members.map(([key]) => key).sort() };
}

function push(map: Map<string, number[]>, key: string, ...dates: number[]): void {
  map.set(key, [...(map.get(key) ?? []), ...dates]);
}
