// End times read on the game's pages, kept per server so that every page can show them.
import { storage } from "wxt/utils/storage";
import type { Sections } from "@/features/end-times/recap";
import { readSection, SOURCE_PAGES, type EndKind, type Section } from "@/game/pages/end-times";
import { fetchGamePage } from "@/utils/game-page";

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

// Read-modify-write: two writes at once (two tabs' features, a page read again) must not drop a section.
let pendingWrite: Promise<void> = Promise.resolve();

export function storeSection(origin: string, section: Section): Promise<void> {
  const write = pendingWrite.then(async () => {
    const stored = (await storage.getItem<Partial<Record<EndKind, StoredSection>>>(key(origin))) ?? {};
    stored[section.kind] = {
      readAt: section.readAt.getTime(),
      items: section.items.map((item) => ({ label: item.label, endsAt: item.endsAt.getTime() })),
    };
    await storage.setItem(key(origin), stored);
  });
  pendingWrite = write.catch(() => undefined);
  return write;
}

/** Reads the pages of `kinds` again (one GET each, with the session cookie); a page that fails keeps its old section. */
export async function refreshSections(origin: string, kinds: EndKind[]): Promise<Sections> {
  for (const kind of kinds) {
    try {
      const doc = await fetchGamePage(`${origin}${SOURCE_PAGES[kind]}`);
      if (!doc) throw new Error(`Fourmizzz: error status on ${SOURCE_PAGES[kind]}`);
      // Dated when the page answered: the countdowns count from then.
      const section = readSection(doc, kind, new Date());
      if (!section) throw new Error(`Fourmizzz: ${SOURCE_PAGES[kind]} is not a logged-in page`);
      await storeSection(origin, section);
    } catch (error) {
      console.warn("[Optizzz] end times: could not read a page again", error);
    }
  }
  return loadSections(origin);
}
