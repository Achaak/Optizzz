"use client";

// The person's key pair and trust list in this browser, for the Alliance Spaces' pages. The private key is opened here
// with the Phrase de chiffrement and never leaves the browser in clear; the trust list is opened, edited and locked here
// before it goes back to the site (ADR 0005). Nobody sees a key: the pages only say « phrase secrète » and
// « Code de sécurité ».
import { generateKeyPair, lockPrivateKey, unlockPrivateKey, type KeyPair } from "@optizzz/crypto/personal-key";
import { lockTrustList, unlockTrustList, type TrustList } from "@optizzz/crypto/trust-list";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { noteTrustRevision, recallKey, rememberKey, seenTrustRevision } from "~/lib/spaces/key-session";
import { emptyTrustList, mergeTrustLists } from "~/lib/spaces/trust-store";
import { api } from "~/trpc/react";

interface SpaceKeys {
  userId: string;
  email: string;
  /** Still asking the site. */
  loading: boolean;
  /** The account has chosen its passphrase (a key pair exists on the site). */
  hasKey: boolean;
  publicKey: string | null;
  /** The opened key pair, once the passphrase was typed on this device. */
  pair: KeyPair | null;
  /** The opened trust list; null while locked or unreadable. */
  trust: TrustList | null;
  /** `unreadable-trust-list`: changed outside the browser. */
  trustUnreadable: boolean;
  /** The site served an older list than one this device has seen. */
  trustOlder: boolean;
  unlock: (passphrase: string, remember: boolean) => Promise<void>;
  /** The first passphrase: the key pair is born here. */
  create: (passphrase: string) => Promise<void>;
  /** Adds to the trust list and writes it, merging with what another tab or device wrote meanwhile. */
  updateTrust: (change: (list: TrustList) => TrustList) => Promise<TrustList>;
  /** Starts again from an empty list (after `unreadable-trust-list`, on the person's click). */
  resetTrust: () => Promise<void>;
  /** After « Changer de phrase » or « J'ai oublié ma phrase »: the pair now in use, opened on this device. */
  adopt: (pair: KeyPair) => Promise<void>;
}

const Context = createContext<SpaceKeys | null>(null);

export function useSpaceKeys(): SpaceKeys {
  const keys = useContext(Context);
  if (!keys) throw new Error("useSpaceKeys outside SpaceKeysProvider");
  return keys;
}

type TrustState = { publicKey: string; revision: number; list: TrustList | null; unreadable: boolean } | null;

export function SpaceKeysProvider({
  userId,
  email,
  children,
}: {
  userId: string;
  email: string;
  children: React.ReactNode;
}) {
  const utils = api.useUtils();
  const key = api.spaces.key.useQuery(undefined, { staleTime: Infinity });
  const createKey = api.spaces.createKey.useMutation();
  const saveTrustList = api.spaces.saveTrustList.useMutation();
  const [opened, setOpened] = useState<KeyPair | null>(null);
  const [trustState, setTrustState] = useState<TrustState>(null);

  const row = key.data ?? null;
  const publicKey = row?.publicKey ?? null;
  // A key opened earlier on this device, for this very key pair (read once the site said which pair is in use).
  const recalled = useMemo(() => (publicKey ? recallKey(userId, publicKey) : null), [userId, publicKey]);
  const candidate = opened ?? recalled;
  const pair = candidate?.publicKey === publicKey ? candidate : null;

  // The trust list, opened as soon as the key is.
  useEffect(() => {
    if (!pair || row?.publicKey !== pair.publicKey) return;
    const run = { cancelled: false };
    const { trustList, trustListRevision } = row;
    (trustList ? unlockTrustList(trustList, pair) : Promise.resolve(emptyTrustList())).then(
      (list) => {
        if (run.cancelled) return;
        noteTrustRevision(userId, trustListRevision);
        setTrustState({ publicKey: pair.publicKey, revision: trustListRevision, list, unreadable: false });
      },
      () => {
        if (!run.cancelled)
          setTrustState({ publicKey: pair.publicKey, revision: trustListRevision, list: null, unreadable: true });
      },
    );
    return () => {
      run.cancelled = true;
    };
  }, [pair, row, userId]);

  const trustHere = trustState?.publicKey === publicKey ? trustState : null;
  const trust = trustHere?.list ?? null;

  const unlock = useCallback(
    async (passphrase: string, remember: boolean) => {
      if (!row) return;
      const next = await unlockPrivateKey(row.lockedPrivateKey, passphrase);
      rememberKey(userId, next, { remember, now: Date.now() });
      setOpened(next);
    },
    [row, userId],
  );

  const create = useCallback(
    async (passphrase: string) => {
      const fresh = await generateKeyPair();
      const lockedPrivateKey = await lockPrivateKey(fresh, passphrase);
      await createKey.mutateAsync({ publicKey: fresh.publicKey, lockedPrivateKey });
      rememberKey(userId, fresh, { remember: false, now: Date.now() });
      setOpened(fresh);
      await utils.spaces.invalidate();
    },
    [createKey, userId, utils],
  );

  const write = useCallback(
    async (change: (list: TrustList) => TrustList, fromScratch: boolean): Promise<TrustList> => {
      if (!pair) throw new Error("locked");
      for (let attempt = 0; attempt < 4; attempt++) {
        const latest = await utils.spaces.key.fetch();
        if (latest?.publicKey !== pair.publicKey) throw new Error("key changed");
        const base =
          fromScratch || !latest.trustList ? emptyTrustList() : await unlockTrustList(latest.trustList, pair);
        const next = change(trust && !fromScratch ? mergeTrustLists(base, trust) : base);
        try {
          const { revision } = await saveTrustList.mutateAsync({
            trustList: await lockTrustList(next, pair),
            expectedRevision: latest.trustListRevision,
          });
          noteTrustRevision(userId, revision);
          setTrustState({ publicKey: pair.publicKey, revision, list: next, unreadable: false });
          await utils.spaces.key.invalidate();
          return next;
        } catch (error) {
          // Another tab or device wrote first: read again and merge.
          if ((error as { data?: { code?: string } }).data?.code !== "CONFLICT") throw error;
        }
      }
      throw new Error("trust list busy");
    },
    [pair, trust, saveTrustList, userId, utils],
  );

  const updateTrust = useCallback((change: (list: TrustList) => TrustList) => write(change, false), [write]);
  const resetTrust = useCallback(async () => {
    await write((list) => list, true);
  }, [write]);

  const adopt = useCallback(
    async (next: KeyPair) => {
      rememberKey(userId, next, { remember: false, now: Date.now() });
      setOpened(next);
      await utils.spaces.invalidate();
    },
    [userId, utils],
  );

  const value = useMemo<SpaceKeys>(
    () => ({
      userId,
      email,
      loading: key.isPending,
      hasKey: row !== null,
      publicKey,
      pair,
      trust,
      trustUnreadable: trustHere?.unreadable ?? false,
      trustOlder: row !== null && row.trustListRevision < seenTrustRevision(userId),
      unlock,
      create,
      updateTrust,
      resetTrust,
      adopt,
    }),
    [
      userId,
      email,
      key.isPending,
      row,
      publicKey,
      pair,
      trust,
      trustHere,
      unlock,
      create,
      updateTrust,
      resetTrust,
      adopt,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
