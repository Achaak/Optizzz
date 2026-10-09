import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NumberField } from "./NumberField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function input(): HTMLInputElement {
  const element = container.querySelector("input");
  if (!element) throw new Error("no input");
  return element;
}

/** Types like a player: React listens to the native value setter and the input event. */
function type(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input(), text);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("NumberField", () => {
  it("keeps what is typed when the value is rewritten meanwhile", () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(<NumberField value={230} onCommit={onCommit} min={1} />);
    });
    type("150");
    // A computation answering late re-renders with the old value.
    act(() => {
      root.render(<NumberField value={230} onCommit={onCommit} min={1} />);
    });
    expect(input().value).toBe("150");
    act(() => {
      input().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(150);
  });

  it("commits after a pause, clamped", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    act(() => {
      root.render(<NumberField value={1} onCommit={onCommit} min={0.1} commitDelayMs={500} />);
    });
    type("0");
    expect(onCommit).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(0.1);
    vi.useRealTimers();
  });

  it("does not commit an emptied field, and shows the value again once left", () => {
    const onCommit = vi.fn();
    act(() => {
      root.render(<NumberField value={1} onCommit={onCommit} min={0.1} />);
    });
    type("");
    expect(input().value).toBe("");
    act(() => {
      input().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(onCommit).not.toHaveBeenCalled();
    expect(input().value).toBe("1");
  });
});
