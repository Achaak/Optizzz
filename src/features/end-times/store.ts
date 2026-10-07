// End times read on the game's pages, kept per server so that every page can show them.
import { storage } from "wxt/utils/storage";
import type { Sections } from "./recap";
import { readSection, SOURCE_PAGES, type EndKind, type Section } from "./sources";

/** Storage keeps JSON: dates are stored as timestamps. */
interface StoredSection {
  readAt: number;
  items: { label: string; endsAt: number }[];
}

const key = (origin: string) => `local:endTimes:${new URL(origin).host}:sections` as const;

export async function loadSections(origin: string): Promise<Sections> {
  const stored = (await storage.getItem<Partial<Record<EndKind, StoredSection>>>(key(origin))) ?? {};
  const sections: Sections = {};
  for (const [kind, section] of Object.entries(stored) as [EndKind, StoredSection][]) {
    sections[kind] = {
      kind,
      readAt: new Date(section.readAt),
      items: section.items.map((item) => ({ label: item.label, endsAt: new Date(item.endsAt) })),
    };
  }
  return sections;
}

export async function storeSection(origin: string, section: Section): Promise<void> {
  const stored = (await storage.getItem<Partial<Record<EndKind, StoredSection>>>(key(origin))) ?? {};
  stored[section.kind] = {
    readAt: section.readAt.getTime(),
    items: section.items.map((item) => ({ label: item.label, endsAt: item.endsAt.getTime() })),
  };
  await storage.setItem(key(origin), stored);
}

/** Reads the pages of `kinds` again (one GET each, with the session cookie); a page that fails keeps its old section. */
export async function refreshSections(origin: string, kinds: EndKind[], now: Date): Promise<Sections> {
  for (const kind of kinds) {
    try {
      const response = await fetch(`${origin}${SOURCE_PAGES[kind]}`);
      if (!response.ok) throw new Error(`Fourmizzz: ${String(response.status)} on ${SOURCE_PAGES[kind]}`);
      const section = readSection(new DOMParser().parseFromString(await response.text(), "text/html"), kind, now);
      if (!section) throw new Error(`Fourmizzz: ${SOURCE_PAGES[kind]} is not a logged-in page`);
      await storeSection(origin, section);
    } catch (error) {
      console.warn("[Optizzz] end times: could not read a page again", error);
    }
  }
  return loadSections(origin);
}
