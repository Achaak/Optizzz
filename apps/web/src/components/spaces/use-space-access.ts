"use client";

// What this browser makes of a space it is a member of: whom to believe, whether its own access opens, which
// certificates the site serves that do not hold. It also does, silently, what ADR 0005 (« Ce que doit faire
// l'interface ») asks: keep the certificates seen in one's trust list, and, as an Admin, certify the Admins one believes.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import type { Certificate } from "@optizzz/crypto/certificate";
import { CryptoError } from "@optizzz/crypto/errors";
import type { SpaceTrust, Trusted } from "@optizzz/crypto/trust";
import { useEffect, useMemo, useRef, useState } from "react";
import { openCertificates, openSpace, owedAdminCertificates, trustedIn } from "~/lib/spaces/access";
import { knowsMore, spaceTrustOf, withCertificates } from "~/lib/spaces/trust-store";
import type { SpaceView } from "~/server/spaces/space-service";
import { api } from "~/trpc/react";
import { useSpaceKeys } from "./space-keys";

export type MemberView = Extract<SpaceView, { kind: "member" }>;

export interface SpaceAccess {
  ready: boolean;
  trust: SpaceTrust;
  trusted: Trusted;
  /** One's Clé d'alliance, every version; null when it does not open. */
  keyring: AllianceKeyring | null;
  keyringError: CryptoError | null;
  /** Certificates served by the site that do not open for this space (`bad-certificate`). */
  badCertificates: number;
  /** Pairs of keys that withdrew each other the Admin role, or excluded each other. */
  crossRevocations: [string, string][];
  /** Whether one compared the Code de sécurité with this key, in this space. */
  verified: (publicKey: string) => boolean;
}

const EMPTY: Trusted = { admins: [], members: [] };

function crossRevocations(certificates: Certificate[]): [string, string][] {
  const revocations = certificates.filter((c) => c.kind === "admin-revocation" || c.kind === "exclusion");
  const pairs = new Map<string, [string, string]>();
  for (const a of revocations) {
    if (revocations.some((b) => b.issuer === a.subject && b.subject === a.issuer)) {
      const pair = [a.issuer, a.subject].sort() as [string, string];
      pairs.set(pair.join(" "), pair);
    }
  }
  return [...pairs.values()];
}

export function useSpaceAccess(view: MemberView | undefined): SpaceAccess {
  const { pair, trust: list, updateTrust } = useSpaceKeys();
  const addCertificates = api.spaces.addCertificates.useMutation();
  const utils = api.useUtils();
  const spaceId = view?.space.id ?? "";
  const siteCertificates = view?.certificates;
  const trust = useMemo(
    () => spaceTrustOf(list ?? { spaces: [] }, spaceId, siteCertificates ?? []),
    [list, spaceId, siteCertificates],
  );
  const [state, setState] = useState<Omit<SpaceAccess, "trust" | "verified">>({
    ready: false,
    trusted: EMPTY,
    keyring: null,
    keyringError: null,
    badCertificates: 0,
    crossRevocations: [],
  });

  useEffect(() => {
    if (!view || !pair || !list) return;
    const run = { cancelled: false };
    void (async () => {
      const [trusted, opened] = await Promise.all([trustedIn(trust), openCertificates(trust)]);
      let keyring: AllianceKeyring | null = null;
      let keyringError: CryptoError | null = null;
      if (view.me.keyStatus === "current") {
        try {
          keyring = await openSpace(pair, view.sealed, trust);
        } catch (error) {
          keyringError = error instanceof CryptoError ? error : null;
        }
      }
      if (run.cancelled) return;
      setState({
        ready: true,
        trusted,
        keyring,
        keyringError,
        badCertificates: opened.bad.length,
        crossRevocations: crossRevocations(opened.valid),
      });
    })();
    return () => {
      run.cancelled = true;
    };
  }, [view, pair, list, trust]);

  // Keep what the site showed (a revocation stays known even if the site hides it later), and, as an Admin, certify
  // the Admins one believes: once per state of the space.
  const duties = useRef("");
  useEffect(() => {
    if (!view || !pair || !list || !state.ready) return;
    const mark = `${spaceId}:${String(view.certificates.length)}:${String(list.spaces.length)}`;
    if (duties.current === mark) return;
    duties.current = mark;
    void (async () => {
      const { validBlobs } = await openCertificates({ ...trust, certificates: view.certificates });
      let owed: string[] = [];
      if (view.me.role === "admin" && view.me.keyStatus === "current" && state.keyring) {
        const siteAdmins = view.members
          .filter((m) => m.role === "admin" && m.keyStatus === "current" && m.publicKey)
          .map((m) => m.publicKey ?? "");
        owed = await owedAdminCertificates({ me: pair, trust, siteAdmins, now: Date.now() });
        if (owed.length > 0) await addCertificates.mutateAsync({ spaceId, certificates: owed });
      }
      const next = withCertificates(list, spaceId, [...validBlobs, ...owed]);
      if (knowsMore(next, list))
        await updateTrust((current) => withCertificates(current, spaceId, [...validBlobs, ...owed]));
      if (owed.length > 0) await utils.spaces.view.invalidate({ spaceId });
    })().catch((error: unknown) => {
      console.error("[Optizzz] the space's silent duties failed", error);
    });
  }, [view, pair, list, state.ready, state.keyring, trust, spaceId, addCertificates, updateTrust, utils]);

  return {
    ...state,
    trust,
    verified: (publicKey) => trust.verified.some((v) => v.publicKey === publicKey),
  };
}
