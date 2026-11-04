import { useEffect, useMemo, useState } from "react";
import { loadPlayersExport, type PlayersExport } from "@/data/exports";
import type { LabelMode, MapDisplay, MapMember } from "./chart-option";
import { formatExportVersion } from "@/utils/export-date";
import { MapChart } from "./MapChart";
import { globalLevel, neighborRows, type KnownLevels } from "./neighbor-table";
import { NeighborTable } from "./NeighborTable";
import { enteredAtOf, useSharedAttackSpeeds } from "./shared-levels";
import { readSettings, writeSettings } from "./settings";
import { refreshLevels } from "@/data/levels";
import { NumberField } from "@/utils/NumberField";
import { useStoredSettings } from "@/utils/useStoredSettings";
import { memberBubbles, rolesTopDown, type MemberBubble } from "@/features/tdc-chain/role-styles";
import { roleKey, roleLabel } from "@optizzz/game/tdc-chain/roles";
import { readChainSettings, watchChainSettings, type ChainSettings } from "@/features/tdc-chain/settings";
import { effectiveChain } from "@/features/tdc-chain/site-roles";
import { useSiteChainRoles } from "@/features/tdc-chain/use-site-chain-roles";

/** One bubble per role in use, from the granaries down. */
function legend(bubbles: ReadonlyMap<number, MemberBubble>): MemberBubble[] {
  const byRole = new Map([...bubbles.values()].map((bubble) => [roleKey(bubble.role), bubble]));
  return rolesTopDown([...byRole.values()].map((bubble) => bubble.role)).flatMap(
    (role) => byRole.get(roleKey(role)) ?? [],
  );
}

/** Legend swatch side when the bubbles' size follows the hunting field. */
const LEGEND_PX = 12;

interface Props {
  origin: string;
  loggedInPseudo: string | null;
  /** Hunting fields read live on the members page, by nickname. */
  liveHuntingFields: ReadonlyMap<string, number>;
  /** « Partage d'alliance » is on: the Attack Speed members shared counts. */
  sharing: boolean;
  /** « Chaîne de TDC » is on: members can be drawn with the bubble of their role. */
  chain: boolean;
}

/** Read fresh at each opening: a research may have ended since the levels were remembered. */
async function fetchLabLevel(origin: string): Promise<number | null> {
  return (await refreshLevels(origin, "laboratoire.php")).attackSpeed ?? null;
}

export function AllianceMap({ origin, loggedInPseudo, liveHuntingFields, sharing, chain }: Props) {
  const host = new URL(origin).host;
  const [playersExport, setPlayersExport] = useState<PlayersExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, updateSettings] = useStoredSettings(host, readSettings, writeSettings);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [chainSettings, setChainSettings] = useState<ChainSettings | null>(null);
  // The space's roles, set on optizzz.fr, prevail over the chain's when the extension can open them.
  const siteRoles = useSiteChainRoles(origin);
  const chainRolesShown = useMemo(
    () => chainSettings && effectiveChain(chainSettings, siteRoles ?? null).roles,
    [chainSettings, siteRoles],
  );

  useEffect(() => {
    if (!chain) return;
    void readChainSettings(host).then(setChainSettings);
    // Roles and colours set in the chain while the map is open: the other view of the same page.
    return watchChainSettings(host, setChainSettings);
  }, [chain, host]);

  useEffect(() => {
    loadPlayersExport(origin).then(setPlayersExport, (e: unknown) => {
      console.error("[Optizzz] alliance map: loading the public export failed", e);
      setError("l'export public de Fourmizzz ne répond pas. Réessayez dans quelques minutes.");
    });
  }, [origin]);

  const settingsRead = settings !== null;
  useEffect(() => {
    if (!settingsRead) return;
    void fetchLabLevel(origin)
      .catch(() => null) // keep the last known level
      .then((labLevel) => {
        if (labLevel !== null) updateSettings((current) => ({ ...current, labLevel }));
      });
  }, [origin, settingsRead, updateSettings]);

  const me = playersExport?.players.find((p) => p.pseudo === loggedInPseudo) ?? null;
  const allianceTag = me?.alliance ?? null;

  // For now: my alliance's members. The filter can later accept other tags.
  const members = useMemo<MapMember[]>(() => {
    if (!playersExport || !allianceTag) return [];
    return playersExport.players
      .filter((p) => p.alliance === allianceTag)
      .map((p) => ({ ...p, huntingField: liveHuntingFields.get(p.pseudo) ?? p.field }));
  }, [playersExport, allianceTag, liveHuntingFields]);

  const showRoles = chain && settings?.showRoles === true;
  const bubbles = useMemo(
    () => (showRoles && chainSettings ? memberBubbles(members, chainRolesShown ?? null, chainSettings.styles) : null),
    [showRoles, chainSettings, chainRolesShown, members],
  );

  const display = useMemo<MapDisplay>(
    () => ({
      sizeByTdc: settings?.sizeByTdc === true,
      // The role is written only while the map shows them.
      labels: settings?.labels === "pseudoRole" && !bubbles ? "pseudo" : (settings?.labels ?? "pseudo"),
    }),
    [settings?.sizeByTdc, settings?.labels, bubbles],
  );

  const shared = useSharedAttackSpeeds(origin, allianceTag, members, sharing);

  const levels = useMemo<KnownLevels | null>(
    () =>
      settings && {
        myId: me?.id ?? null,
        labLevel: settings.labLevel,
        manualLevel: settings.manualLevel,
        byPlayer: new Map(Object.entries(settings.playerLevels).map(([id, level]) => [Number(id), level])),
        enteredAt: enteredAtOf(settings.playerLevelsAt),
        shared,
      },
    [settings, me?.id, shared],
  );

  if (error)
    return (
      <div className="alliance-map optizzz-panel optizzz-panel--danger">
        Impossible de charger les positions : {error}
      </div>
    );
  if (!playersExport || !settings || !levels)
    return <div className="alliance-map optizzz-panel">Chargement des positions…</div>;
  const myMember = members.find((m) => m.id === me?.id);
  if (!myMember || !allianceTag) {
    return (
      <div className="alliance-map optizzz-panel">
        Votre alliance n'apparaît pas dans l'export du {formatExportVersion(playersExport.version)}. Si vous venez de la
        rejoindre, elle apparaîtra à la prochaine mise à jour de l'export, dans l'heure.
      </div>
    );
  }

  const selected = members.find((m) => m.id === selectedId) ?? myMember;
  const k = Math.min(settings.k, members.length - 1);

  return (
    <div className="alliance-map optizzz-panel">
      <h2 className="optizzz-panel-title">Carte de l'alliance {allianceTag}</h2>
      <p className="optizzz-note">
        {members.length} membres · positions du {formatExportVersion(playersExport.version)} · TDC{" "}
        {liveHuntingFields.size > 0 ? "en direct (page Membres)" : "de l'export"}
      </p>

      <div className="settings">
        <label>
          Voisins reliés à chaque membre sur la carte :{" "}
          <NumberField
            min={1}
            max={Math.max(1, members.length - 1)}
            integer
            value={k}
            onCommit={(value) => {
              if (value !== null) updateSettings((s) => ({ ...s, k: value }));
            }}
          />
        </label>
        <label>
          Vitesse d'attaque par défaut :{" "}
          <NumberField
            min={0}
            max={30}
            integer
            allowEmpty
            placeholder={String(settings.labLevel ?? 0)}
            value={settings.manualLevel}
            onCommit={(manualLevel) => {
              updateSettings((s) => ({ ...s, manualLevel }));
            }}
          />
        </label>
        <span className="optizzz-note">
          Utilisée pour les membres dont on ne connaît pas la Vitesse d'attaque (actuellement niveau{" "}
          {globalLevel(levels)}). Vide = votre niveau du Laboratoire
          {settings.labLevel !== null && ` (${settings.labLevel})`}.
        </span>
      </div>

      <div className="settings">
        {chain && (
          <label>
            <input
              type="checkbox"
              checked={settings.showRoles}
              onChange={(e) => {
                const showRoles = e.target.checked;
                updateSettings((s) => ({ ...s, showRoles }));
              }}
            />{" "}
            Couleurs des rôles de la chaîne
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={settings.sizeByTdc}
            onChange={(e) => {
              const sizeByTdc = e.target.checked;
              updateSettings((s) => ({ ...s, sizeByTdc }));
            }}
          />{" "}
          Taille selon le TDC
        </label>
        <label>
          Étiquettes :{" "}
          <select
            value={display.labels}
            onChange={(e) => {
              const labels = e.target.value as LabelMode;
              updateSettings((s) => ({ ...s, labels }));
            }}
          >
            {bubbles && <option value="pseudoRole">Pseudo et rôle</option>}
            <option value="pseudo">Pseudo</option>
            <option value="none">Aucune</option>
          </select>
        </label>
        {display.sizeByTdc && <span className="optizzz-note">Taille des bulles : proportionnelle au TDC.</span>}
      </div>

      {chain && bubbles && (
        <div className="settings">
          <ul className="role-legend" aria-label="Rôles de la chaîne">
            {legend(bubbles).map(({ role, color, px, shape }) => {
              // The size no longer says the role when it follows the hunting field.
              const side = display.sizeByTdc ? LEGEND_PX : px;
              return (
                <li key={roleKey(role)}>
                  <span
                    className="optizzz-shape"
                    data-shape={shape}
                    style={{ background: color, width: side, height: side }}
                  />
                  {roleLabel(role)}
                </li>
              );
            })}
          </ul>
          <span className="optizzz-note">
            Couleurs et tailles réglables dans <a href="#chaine">Chaîne</a>
            {!chainRolesShown && " ; rôles proposés d'après le TDC tant qu'ils n'y sont pas choisis"}.
          </span>
        </div>
      )}

      <MapChart
        members={members}
        selected={selected}
        k={k}
        levels={levels}
        bubbles={bubbles}
        display={display}
        onSelect={setSelectedId}
      />

      <NeighborTable
        selected={selected}
        rows={neighborRows(selected, members, k, levels)}
        playerLevels={Object.fromEntries(
          // A level entered before a newer shared state no longer counts: the field shows the shared one.
          Object.entries(settings.playerLevels).filter(([id]) => {
            const sharedLevel = shared.get(Number(id));
            return !sharedLevel || (settings.playerLevelsAt[id] ?? 0) > sharedLevel.at.getTime();
          }),
        )}
        defaultLevel={globalLevel(levels)}
        levels={levels}
        onSelect={setSelectedId}
        onLevelChange={(playerId, level) =>
          updateSettings((s) => {
            const others = <T,>(byId: Record<string, T>) =>
              Object.fromEntries(Object.entries(byId).filter(([id]) => id !== String(playerId)));
            return level === null
              ? { ...s, playerLevels: others(s.playerLevels), playerLevelsAt: others(s.playerLevelsAt) }
              : {
                  ...s,
                  playerLevels: { ...s.playerLevels, [playerId]: level },
                  playerLevelsAt: { ...s.playerLevelsAt, [playerId]: Date.now() },
                };
          })
        }
      />
    </div>
  );
}
