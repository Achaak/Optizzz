import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FieldForecast } from "./FieldForecast";
import type { Settings } from "./settings";

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

type Forecast = Settings["fieldForecast"];

function render(forecast: Forecast, { onChange = vi.fn(), hidden = false, onApply = vi.fn() } = {}) {
  act(() => {
    root.render(<FieldForecast forecast={forecast} onChange={onChange} hidden={hidden} onApply={onApply} />);
  });
  return { onChange, onApply };
}

const box = () => container.querySelector<HTMLInputElement>("input[type=checkbox]");
function field() {
  const input = container.querySelector<HTMLInputElement>("input[type=text]");
  if (!input) throw new Error("no forecast field");
  return input;
}

function type(input: HTMLInputElement, text: string) {
  // React watches the value property: the prototype's setter makes the change visible to it.
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  act(() => {
    descriptor?.set?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}

describe("FieldForecast", () => {
  it("is ticked and unticked, keeping the change", () => {
    const { onChange } = render({ enabled: false, change: -3_000 });
    act(() => {
      box()?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith({ enabled: true, change: -3_000 });
  });

  it("ticks itself when a change is typed", () => {
    const { onChange } = render({ enabled: false, change: 0 });
    type(field(), "-12k");
    expect(onChange).toHaveBeenLastCalledWith({ enabled: true, change: -12_000 });
  });

  it("leaves the box as it was when the change is cleared to 0", () => {
    const { onChange } = render({ enabled: false, change: 5_000 });
    type(field(), "0");
    expect(onChange).toHaveBeenLastCalledWith({ enabled: false, change: 0 });
  });

  it("shows the change with its sign", () => {
    render({ enabled: true, change: 5_000 });
    expect(field().value).toBe("+5 000");
    render({ enabled: true, change: -12_000 });
    expect(field().value).toBe("−12 000");
  });

  it("says when a typed arrival field hides it, and applies it again on a click", () => {
    const { onApply } = render({ enabled: true, change: -12_000 }, { hidden: true });
    expect(container.textContent).toContain("ignorée");
    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });
    expect(onApply).toHaveBeenCalled();
    render({ enabled: false, change: -12_000 }, { hidden: true });
    expect(container.textContent).not.toContain("ignorée");
  });
});
