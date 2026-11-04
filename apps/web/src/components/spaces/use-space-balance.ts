"use client";

// The Équilibre of a space (docs/features/site-envois.md, « Équilibre des ressources »): the members' TDC and alliance
// day by day, and those of the players they colonize, served by the site from the public export (90 days at once,
// whatever the period), put together here with the convoys and states opened with the Clé d'alliance.
import type { MemberStates } from "@optizzz/game/sharing/shared-state";
import type { ConvoyItem } from "@optizzz/game/site-links/envoi-convoys";
import { useMemo } from "react";
import {
  balanceOf,
  balancePlayers,
  taxRatesOf,
  warehouseInputOf,
  type Balance,
  type WarehouseInput,
} from "~/lib/envois/balance";
import { api } from "~/trpc/react";

/** The longest period: the days are read once for all. */
const DAYS_READ = 90;

export function useSpaceBalance(input: {
  server: string;
  tag: string;
  members: readonly { playerId: number; pseudo: string }[];
  /** What each member sends, as their extension said. */
  sends: readonly { playerId: number; categories: readonly string[] }[];
  /** Null while the access is not open on this device. */
  convoys: readonly ConvoyItem[] | null;
  states: readonly MemberStates[] | null;
  days: number;
  /** False: nothing is read (another view is shown). */
  enabled: boolean;
}): { balance: Balance | null; loading: boolean } {
  const query = api.players.allianceDays.useQuery(
    { server: input.server, ids: input.members.map((m) => m.playerId), days: DAYS_READ },
    { enabled: input.enabled && input.convoys !== null, staleTime: 10 * 60_000 },
  );
  const { members, sends, convoys, states, tag, days } = input;
  const data = query.data;
  const balance = useMemo(() => {
    if (!data || !convoys) return null;
    const players = balancePlayers(data);
    const latest = (states ?? []).map((s) => s.latest);
    const warehouses: Record<string, WarehouseInput> = {};
    for (const state of latest) {
      const warehouse = warehouseInputOf(state);
      if (warehouse) warehouses[state.pseudo.toLowerCase()] = warehouse;
    }
    const senders = members
      .filter((m) => sends.find((s) => s.playerId === m.playerId)?.categories.includes("convoys"))
      .map((m) => m.pseudo);
    return balanceOf({
      tag,
      members: members.map((m) => m.pseudo),
      senders,
      players,
      convoys,
      taxRates: taxRatesOf(latest, players),
      warehouses,
      days,
      now: new Date(),
    });
  }, [data, convoys, states, members, sends, tag, days]);
  return { balance, loading: query.isPending && input.enabled };
}
