import { storage } from "wxt/utils/storage";
import type { ShareChoices } from "./my-state";

/** What the player shares, stored per server: the army as a number by default (docs/features/partage-alliance.md). */
export const DEFAULT_CHOICES: ShareChoices = {
  buildings: true,
  research: true,
  works: true,
  workers: true,
  huntingField: true,
  army: "total",
};

const key = (host: string) => `local:allianceSharing:${host}:choices` as const;

export async function readChoices(host: string): Promise<ShareChoices> {
  return { ...DEFAULT_CHOICES, ...(await storage.getItem<Partial<ShareChoices>>(key(host))) };
}

export async function writeChoices(host: string, choices: ShareChoices): Promise<void> {
  await storage.setItem(key(host), choices);
}
