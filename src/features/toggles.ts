import { storage } from "wxt/utils/storage";
import type { FeatureId } from "./catalog";

/**
 * Switches of « Fonctionnalités », keyed by feature id or `featureId.optionId`. Only `false` is ever
 * meaningful: a missing key means on. Global (not per server) and synced: it is the player's choice.
 */
export type Toggles = Partial<Record<string, boolean>>;

export const TOGGLES_KEY = "sync:featureToggles";

const toggleKey = (feature: FeatureId, option?: string) => (option ? `${feature}.${option}` : feature);

/** An option is on only when its feature is on too. */
export function isEnabled(toggles: Toggles, feature: FeatureId, option?: string): boolean {
  if (toggles[feature] === false) return false;
  return option === undefined || toggles[toggleKey(feature, option)] !== false;
}

export async function loadToggles(): Promise<Toggles> {
  return (await storage.getItem<Toggles>(TOGGLES_KEY)) ?? {};
}

/** For heavy content scripts, before they do anything. */
export async function isFeatureEnabled(feature: FeatureId): Promise<boolean> {
  return isEnabled(await loadToggles(), feature);
}

/** A copy of `toggles` with one switch changed. */
export function withToggle(
  toggles: Toggles,
  feature: FeatureId,
  option: string | undefined,
  enabled: boolean,
): Toggles {
  const key = toggleKey(feature, option);
  const others = Object.fromEntries(Object.entries(toggles).filter(([other]) => other !== key));
  return enabled ? others : { ...others, [key]: false };
}

// Read-modify-write: two quick clicks must not both read the old state, or the second write drops the first.
let pendingWrite: Promise<void> = Promise.resolve();

export function setToggle(feature: FeatureId, option: string | undefined, enabled: boolean): Promise<void> {
  const write = pendingWrite.then(async () => {
    await storage.setItem(TOGGLES_KEY, withToggle(await loadToggles(), feature, option, enabled));
  });
  pendingWrite = write.catch(() => undefined);
  return write;
}
