// The trust list as the browser edits it (ADR 0005, « Qui croire » and « Liste de confiance verrouillée »): the keys one
// checked by a Code de sécurité, and the certificates one has seen, space by space. Pure: locking and storing it is
// use-space-keys.tsx's job. Nothing is ever removed: a revocation one has seen stays, even if the site hides it later.
import type { SpaceTrust, VerifiedKey } from "@optizzz/crypto/trust";
import type { TrustList } from "@optizzz/crypto/trust-list";

export const emptyTrustList = (): TrustList => ({ spaces: [] });

const spaceOf = (list: TrustList, spaceId: string): SpaceTrust =>
  list.spaces.find((s) => s.spaceId === spaceId) ?? { spaceId, verified: [], certificates: [] };

const withSpace = (list: TrustList, space: SpaceTrust): TrustList => ({
  spaces: [...list.spaces.filter((s) => s.spaceId !== space.spaceId), space],
});

/** What one knows of a space: one's list, and the certificates the site serves (bad ones are ignored downstream). */
export function spaceTrustOf(list: TrustList, spaceId: string, siteCertificates: readonly string[] = []): SpaceTrust {
  const space = spaceOf(list, spaceId);
  return {
    spaceId,
    verified: space.verified,
    certificates: [...new Set([...space.certificates, ...siteCertificates])],
  };
}

/** A key whose Code de sécurité matched. The same key in the same role keeps its latest exchange only. */
export function withVerified(list: TrustList, spaceId: string, key: VerifiedKey): TrustList {
  const space = spaceOf(list, spaceId);
  const others = space.verified.filter((v) => !(v.publicKey === key.publicKey && v.role === key.role));
  return withSpace(list, { ...space, verified: [...others, key] });
}

/** Certificates seen or signed, added once. */
export function withCertificates(list: TrustList, spaceId: string, blobs: readonly string[]): TrustList {
  const space = spaceOf(list, spaceId);
  const fresh = blobs.filter((b) => !space.certificates.includes(b));
  if (fresh.length === 0) return list;
  return withSpace(list, { ...space, certificates: [...space.certificates, ...fresh] });
}

/** Two versions of one's list (two tabs, two devices): everything either knows. */
export function mergeTrustLists(a: TrustList, b: TrustList): TrustList {
  let merged = a;
  for (const space of b.spaces) {
    for (const key of space.verified) {
      const known = spaceOf(merged, space.spaceId).verified.find(
        (v) => v.publicKey === key.publicKey && v.role === key.role,
      );
      if (!known || known.verifiedAt < key.verifiedAt) merged = withVerified(merged, space.spaceId, key);
    }
    merged = withCertificates(merged, space.spaceId, space.certificates);
    if (!merged.spaces.some((s) => s.spaceId === space.spaceId)) merged = withSpace(merged, space);
  }
  return merged;
}

/** Whether `next` knows something `previous` does not (then it is worth writing). */
export function knowsMore(next: TrustList, previous: TrustList): boolean {
  return next.spaces.some((space) => {
    const old = spaceOf(previous, space.spaceId);
    return (
      space.certificates.some((c) => !old.certificates.includes(c)) ||
      space.verified.some(
        (v) =>
          !old.verified.some((o) => o.publicKey === v.publicKey && o.role === v.role && o.verifiedAt >= v.verifiedAt),
      )
    );
  });
}
