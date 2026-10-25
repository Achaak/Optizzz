"use client";

// The departure alerts of a space, for an Admin or a Délégué (src/lib/spaces/absences.ts). Opening the page, or coming
// back to it from the game, asks this browser's extension for its last list of the game's Members page; a newer list
// updates the alerts, encrypted here with the Clé d'alliance, for the other Admins and Délégués. The list itself stays
// in this browser.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import { useEffect, useState } from "react";
import {
  absencesToShow,
  lockAbsences,
  openAbsences,
  updateAbsences,
  type Absence,
  type AbsenceRecord,
} from "~/lib/spaces/absences";
import { askExtensionForMembers } from "~/lib/spaces/extension-bridge";
import { api } from "~/trpc/react";
import type { MemberView } from "./use-space-access";

const same = (a: AbsenceRecord | null, b: AbsenceRecord) =>
  a !== null && JSON.stringify(a.absent) === JSON.stringify(b.absent);

/** One more each time the page comes back into view: the Admin may have just opened the Members page in the game. */
function useReturns(): number {
  const [returns, setReturns] = useState(0);
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible") setReturns((n) => n + 1);
    };
    document.addEventListener("visibilitychange", back);
    return () => document.removeEventListener("visibilitychange", back);
  }, []);
  return returns;
}

export function useAbsenceAlerts(view: MemberView, keyring: AllianceKeyring | null): Absence[] {
  const save = api.spaces.saveAbsenceAlerts.useMutation();
  const utils = api.useUtils();
  const [record, setRecord] = useState<AbsenceRecord | null>(null);
  const returns = useReturns();
  const enabled = view.me.role !== "member" && view.me.keyStatus === "current" && keyring !== null;
  const { mutateAsync } = save;

  useEffect(() => {
    if (!enabled) return;
    const run = { cancelled: false };
    const cancelled = () => run.cancelled;
    void (async () => {
      const stored = view.absenceAlerts;
      let previous: AbsenceRecord | null = null;
      if (stored) {
        try {
          previous = await openAbsences(stored.blob, keyring);
        } catch (error) {
          // Not written over: it may be a newer version this page has not opened yet.
          console.error("[Optizzz] the absence alerts do not open", error);
          return;
        }
      }
      if (cancelled()) return;
      setRecord(previous);
      const answer = await askExtensionForMembers(view.space.server);
      if (cancelled() || answer?.status !== "linked" || !answer.members) return;
      const next = updateAbsences(previous, answer.members, { tag: view.space.tag, members: view.members });
      if (!next) return;
      // A newer reading that changes nothing is not written: the date of the last reading is not worth a write.
      if (same(previous, next) || cancelled()) return;
      await mutateAsync({
        spaceId: view.space.id,
        blob: await lockAbsences(next, keyring),
        expectedRevision: stored?.revision ?? 0,
      });
      if (!cancelled()) setRecord(next);
      await utils.spaces.view.invalidate({ spaceId: view.space.id });
    })().catch(async (error: unknown) => {
      // Written meanwhile (another Admin or Délégué, or this page a moment ago): read again, and the next pass starts
      // from theirs. Anything else is only logged: the alerts wait for the next visit.
      if ((error as { data?: { code?: string } }).data?.code !== "CONFLICT")
        console.error("[Optizzz] the absence alerts could not be updated", error);
      await utils.spaces.view.invalidate({ spaceId: view.space.id });
    });
    return () => {
      run.cancelled = true;
    };
  }, [enabled, view, keyring, returns, mutateAsync, utils]);

  return enabled ? absencesToShow(record, view.members) : [];
}
