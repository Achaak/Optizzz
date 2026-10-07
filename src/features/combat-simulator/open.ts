// Opening the simulator page: an extension page can be opened by the extension only, so content scripts ask the
// background script (no extra permission: tabs.create needs none).

export type SimulatorSide = "attack" | "defend";

export interface OpenSimulatorMessage {
  type: "open-combat-simulator";
  /** Game server whose remembered army and levels fill the form, e.g. "s5.fourmizzz.fr". */
  server: string;
  side: SimulatorSide;
}

/** Without a server, the page falls back on the one whose army was read last. */
export function simulatorUrl(server: string | null, side: SimulatorSide): string {
  const query = new URLSearchParams({ side, ...(server ? { server } : {}) });
  return browser.runtime.getURL(`/combat-simulator.html?${query.toString()}`);
}

/** From a content script. */
export function requestSimulator(server: string, side: SimulatorSide): Promise<unknown> {
  const message: OpenSimulatorMessage = { type: "open-combat-simulator", server, side };
  return browser.runtime.sendMessage(message);
}

export function isOpenSimulatorMessage(message: unknown): message is OpenSimulatorMessage {
  return (
    typeof message === "object" && message !== null && (message as { type?: unknown }).type === "open-combat-simulator"
  );
}
