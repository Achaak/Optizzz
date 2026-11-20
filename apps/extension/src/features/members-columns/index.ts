import { storage } from "wxt/utils/storage";
import { loadPlayersExport } from "@/data/exports";
import { INACTIVITY_DAYS, loadRecentNights } from "@/data/nights";
import type { Snapshot } from "@/features/history/api";
import type { Player } from "@optizzz/game/exports";
import { loadLevelsOf, unknownLevelsHint } from "@/data/levels";
import { readLoggedInPseudo, readMembersHuntingField } from "@optizzz/game/pages/alliance";
import { readChainSettings, watchChainSettings, type ChainSettings } from "@/features/tdc-chain/settings";
import { effectiveChain } from "@/features/tdc-chain/site-roles";
import { followSiteChainRoles } from "@/features/tdc-chain/site-roles-source";
import type { ChainRolesAnswer } from "@/features/optizzz-account/envois";
import type { Feature } from "../feature";
import { isEnabled } from "../toggles";
import {
  addMembersColumns,
  COLUMN_CLASS,
  MEMBERS_COLUMNS_STYLE,
  removeMembersColumns,
  addColumnPicker,
  hideMembersColumns,
  type MembersColumnsContext,
  type MemberEvolution,
} from "./mount";
import { isMembersPage } from "@/utils/alliance-views";
import { rolesOfMembers } from "./roles";
import { tripsFrom } from "./trips";

/** Each member's live field against the last midnight export and the one 7 days before, by lowercase nickname. */
function evolutionOfMembers(nights: readonly Snapshot[], players: readonly Player[]): Map<string, MemberEvolution> {
  const ids = new Map(players.map((player) => [player.pseudo.toLowerCase(), player.id]));
  const midnight = nights.at(-1);
  // dailyVersions over 8 days: the first is a week before the last, when no night is missing.
  const weekAgo = nights.length === INACTIVITY_DAYS ? nights[0] : undefined;
  const evolution = new Map<string, MemberEvolution>();
  for (const [pseudo, live] of readMembersHuntingField(document)) {
    const id = ids.get(pseudo.toLowerCase());
    evolution.set(pseudo.toLowerCase(), {
      live,
      midnight: id === undefined ? null : (midnight?.players.get(id)?.field ?? null),
      weekAgo: id === undefined ? null : (weekAgo?.players.get(id)?.field ?? null),
    });
  }
  return evolution;
}

/**
 * « Trajet » and « Rôle » columns in the members table: my trip to each member, its role in the TDC chain.
 * See docs/features/colonnes-membres.md.
 */
export const membersColumns: Feature = {
  id: "members-columns",
  toggle: "members-columns",
  matches: (url) => isMembersPage(url),
  async run(ctx, toggles) {
    const myPseudo = readLoggedInPseudo(document);
    const allianceContent = document.getElementById("alliance");
    if (!myPseudo || !allianceContent) return;
    const showTrips = isEnabled(toggles, "members-columns", "trips");
    // The roles are the chain's: none while the chain is switched off.
    const showRoles = isEnabled(toggles, "members-columns", "roles") && isEnabled(toggles, "tdc-chain");
    const showEvolution = isEnabled(toggles, "members-columns", "evolution");

    // « Colonnes »: the columns hidden, the game's and Optizzz's, remembered per server.
    const hiddenKey = `local:members-columns:${location.host}:hidden` as const;
    let hidden = new Set((await storage.getItem<string[]>(hiddenKey)) ?? []);
    const chooseColumns = (next: Set<string>) => {
      hidden = next;
      hideMembersColumns(document, hidden);
      void storage.setItem(hiddenKey, [...hidden]);
    };

    const [playersExport, levels, chainSettings] = await Promise.all([
      loadPlayersExport(location.origin).catch((error: unknown) => {
        console.warn("[Optizzz] members-columns: public export unavailable", error);
        return null;
      }),
      showTrips ? loadLevelsOf(location.origin, ["attackSpeed"]).catch((error: unknown) => ({ error })) : null,
      showRoles ? readChainSettings(location.host) : null,
    ]);
    const exportMissing = "L'export public de Fourmizzz ne répond pas : trajets indisponibles.";
    const trips: MembersColumnsContext["trips"] = !levels
      ? undefined
      : "error" in levels
        ? { byPseudo: null, missing: `${unknownLevelsHint(levels.error)} Les trajets en dépendent.` }
        : playersExport
          ? { byPseudo: tripsFrom(playersExport.players, myPseudo, levels.attackSpeed) }
          : { byPseudo: null, missing: exportMissing };

    let chain: ChainSettings | null = chainSettings;
    // The nightly exports, for « Aujourd'hui » and « 7 j »: the columns come once they are loaded.
    let nights: Snapshot[] | null = null;
    // The space's roles, set on optizzz.fr, prevail over the chain's when the extension can open them.
    let site: ChainRolesAnswer | null = null;
    const style = document.createElement("style");
    style.textContent = MEMBERS_COLUMNS_STYLE;
    document.head.append(style);

    // The game fills #alliance over AJAX, and fills it again when the table changes: add the columns each time.
    const apply = () => {
      // The columns already there: only « Colonnes » and what it hides, again (the game may have redrawn the rows).
      if (document.querySelector(`#tabMembresAlliance .${COLUMN_CLASS}`)) {
        addColumnPicker(document, hidden, chooseColumns);
        hideMembersColumns(document, hidden);
        return;
      }
      const roles =
        chain && playersExport
          ? rolesOfMembers(playersExport.players, myPseudo, readMembersHuntingField(document), {
              roles: effectiveChain(chain, site).roles,
              styles: chain.styles,
            })
          : undefined;
      const evolution = nights && playersExport ? evolutionOfMembers(nights, playersExport.players) : undefined;
      addMembersColumns(document, { myPseudo, trips, roles, evolution }, new Date());
      addColumnPicker(document, hidden, chooseColumns);
      hideMembersColumns(document, hidden);
    };
    apply();
    if (showEvolution) {
      loadRecentNights(location.origin).then(
        (loaded) => {
          nights = loaded;
          removeMembersColumns(document);
          apply();
        },
        (error: unknown) => {
          console.warn("[Optizzz] members-columns: nightly exports unavailable", error);
        },
      );
    }
    const observer = new MutationObserver(apply);
    observer.observe(allianceContent, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    if (showRoles) {
      // Roles or colours changed in the chain (another tab): shown at once.
      const unwatch = watchChainSettings(location.host, (settings) => {
        chain = settings;
        removeMembersColumns(document);
        apply();
      });
      ctx.onInvalidated(unwatch);
      const unfollow = followSiteChainRoles(location.origin, (answer) => {
        site = answer;
        removeMembersColumns(document);
        apply();
      });
      ctx.onInvalidated(unfollow);
    }
  },
};
