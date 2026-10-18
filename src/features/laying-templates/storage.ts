import { storage } from "wxt/utils/storage";
import { z } from "zod";
import type { Target, TemplateLine } from "./template";

/** A template the player saved. */
export interface SavedTemplate {
  id: string;
  name: string;
  lines: TemplateLine[];
  target: Target | null;
  /** How many times the lines take turns in the queue. */
  rotations: number;
}

/** The templates of one server, and whether their box is open. */
export interface StoredTemplates {
  open: boolean;
  templates: SavedTemplate[];
}

const place = z.enum(["field", "nest", "lodge"]);
const line = z.object({ unit: z.string(), destination: place, amount: z.number().nonnegative() });
const clock = z.object({ hours: z.number().int().min(0).max(23), minutes: z.number().int().min(0).max(59) });
const target = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("duration"), hours: z.number().positive() }),
  z.object({ kind: z.literal("until"), clock }),
  z.object({ kind: z.literal("food") }),
]);

/** A template whose broken parts are left out (a bad line, an unknown target), or null when it has no id or name. */
function readTemplate(value: unknown): SavedTemplate | null {
  const base = z.object({ id: z.string(), name: z.string(), lines: z.array(z.unknown()) }).safeParse(value);
  if (!base.success) return null;
  const raw = value as { target?: unknown; rotations?: unknown };
  const rotations = z.number().int().min(1).safeParse(raw.rotations);
  return {
    id: base.data.id,
    name: base.data.name,
    lines: base.data.lines.flatMap((item) => {
      const parsed = line.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    }),
    target: target.safeParse(raw.target).data ?? null,
    rotations: rotations.success ? rotations.data : 1,
  };
}

const key = (host: string) => `local:layingTemplates:${host}` as const;

export async function readTemplates(host: string): Promise<StoredTemplates> {
  const stored = await storage.getItem<{ open?: unknown; templates?: unknown }>(key(host));
  const templates = Array.isArray(stored?.templates) ? stored.templates : [];
  return {
    open: stored?.open !== false,
    templates: templates.flatMap((item) => {
      const template = readTemplate(item);
      return template ? [template] : [];
    }),
  };
}

export async function writeTemplates(host: string, stored: StoredTemplates): Promise<void> {
  await storage.setItem(key(host), stored);
}
