// Opening the server map page: over the game in a dialog (src/utils/page-dialog.ts), or in a tab asked of the
// background script (an extension page can be opened by the extension only; tabs.create needs no permission).
import type { ChipTarget } from "@optizzz/map/selection";

export interface OpenServerMapMessage {
  type: "open-server-map";
  /** Game server, e.g. "https://s5.fourmizzz.fr" (S1–S4 are served over HTTP only). */
  origin: string;
  target: ChipTarget | null;
}

/** `target` in an address: "player:123", "alliance:TAG" or "unaffiliated". */
export function encodeTarget(target: ChipTarget): string {
  if (target.kind === "player") return `player:${String(target.id)}`;
  return target.kind === "alliance" ? `alliance:${target.tag}` : "unaffiliated";
}

export function decodeTarget(text: string | null | undefined): ChipTarget | null {
  if (text === "unaffiliated") return { kind: "unaffiliated" };
  const match = /^(player|alliance):(.+)$/.exec(text ?? "");
  if (!match?.[2]) return null;
  if (match[1] === "alliance") return { kind: "alliance", tag: match[2] };
  const id = Number(match[2]);
  return Number.isInteger(id) ? { kind: "player", id } : null;
}

/** Without an origin, the page takes the server of the last game tab. Embedded: framed in the in-game dialog. */
export function serverMapUrl(origin: string | null, target: ChipTarget | null, { embedded = false } = {}): string {
  const query = new URLSearchParams({
    ...(origin ? { server: origin } : {}),
    ...(target ? { target: encodeTarget(target) } : {}),
    ...(embedded ? { embedded: "1" } : {}),
  });
  const search = query.toString();
  return browser.runtime.getURL(`/server-map.html${search ? `?${search}` : ""}`);
}

/** From a content script. */
export function requestServerMap(origin: string, target: ChipTarget | null): Promise<unknown> {
  const message: OpenServerMapMessage = { type: "open-server-map", origin, target };
  return browser.runtime.sendMessage(message);
}

export function isOpenServerMapMessage(message: unknown): message is OpenServerMapMessage {
  return typeof message === "object" && message !== null && (message as { type?: unknown }).type === "open-server-map";
}
