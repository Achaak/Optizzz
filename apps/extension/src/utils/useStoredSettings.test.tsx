import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useStoredSettings } from "./useStoredSettings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useStoredSettings", () => {
  it("reads the settings, then saves each change once", async () => {
    const read = vi.fn(() => Promise.resolve({ k: 3 }));
    const write = vi.fn(() => Promise.resolve());
    let update: ((change: (current: { k: number }) => { k: number }) => void) | undefined;
    let shown: { k: number } | null = null;
    function View() {
      const [settings, change] = useStoredSettings("s5.fourmizzz.fr", read, write);
      shown = settings;
      update = change;
      return null;
    }
    const root = createRoot(document.createElement("div"));
    await act(async () => {
      root.render(<View />);
      await Promise.resolve();
    });
    expect(shown).toEqual({ k: 3 });
    expect(write).not.toHaveBeenCalled();
    act(() => {
      update?.((current) => ({ k: current.k + 1 }));
    });
    expect(shown).toEqual({ k: 4 });
    expect(write).toHaveBeenCalledExactlyOnceWith("s5.fourmizzz.fr", { k: 4 });
    act(() => {
      root.unmount();
    });
  });
});
